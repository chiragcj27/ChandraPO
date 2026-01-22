import axios, { AxiosInstance } from 'axios';

interface LoginResponse {
  accessToken: string; // camelCase in API response
  tokenType: string;
  expiresIn: number;
  idToken?: string;
  refreshToken?: string;
  error?: string | null;
  errorDescription?: string | null;
}

interface UserEnvironment {
  userCustomerID: string;
  [key: string]: any;
}

interface TrackingStatus {
  status: string;
  timestamp: Date;
  location?: string;
  description?: string;
}

interface TrackingResponse {
  shipmentNumber: string;
  status: string;
  statusHistory: Array<{
    status: string;
    date: string;
    location?: string;
    description?: string;
  }>;
  [key: string]: any;
}

class MalcaAmitService {
  private apiClient: AxiosInstance;
  private accessToken: string | null = null;
  private userCustomerID: string | null = null;
  private tokenExpiry: Date | null = null;
  private loginPromise: Promise<void> | null = null; // Prevent concurrent logins

  private readonly username: string;
  private readonly password: string;
  private readonly baseURL: string = 'https://api.malca-amit.com';

  constructor() {
    this.username = process.env.MALCA_AMIT_USERNAME || 'edp@chandrajewels.com';
    this.password = process.env.MALCA_AMIT_PASSWORD || 'Chandra1234#';

    this.apiClient = axios.create({
      baseURL: this.baseURL,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add request interceptor to add auth token
    this.apiClient.interceptors.request.use(
      async (config) => {
        // Refresh token if needed
        if (!this.accessToken || !this.tokenExpiry || new Date() >= this.tokenExpiry) {
          await this.login();
        }

        if (this.accessToken) {
          config.headers.Authorization = `Bearer ${this.accessToken}`;
        }

        if (this.userCustomerID) {
          config.headers.UserCustomerID = this.userCustomerID;
        }

        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );
  }

  /**
   * Login to get access token
   */
  async login(): Promise<void> {
    // If already logging in, wait for that to complete
    if (this.loginPromise) {
      return this.loginPromise;
    }

    this.loginPromise = (async () => {
      try {
        console.log('Starting Malca-Amit login...');
        const formData = new URLSearchParams();
        formData.append('username', this.username);
        formData.append('password', this.password);

        console.log(`Calling login API: ${this.baseURL}/api/Account/Login`);
        const response = await axios.post<LoginResponse>(
          `${this.baseURL}/api/Account/Login`,
          formData,
          {
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
          }
        );

        console.log('Login API response received:', {
          status: response.status,
          hasData: !!response.data,
          hasAccessToken: !!response.data?.accessToken,
        });

        // Validate response - API uses camelCase
        if (!response.data || !response.data.accessToken) {
          console.error('Login response missing accessToken. Full response:', JSON.stringify(response.data, null, 2));
          throw new Error('Login response did not contain accessToken');
        }

        // Check for errors in response
        if (response.data.error) {
          console.error('Login API returned error:', response.data.error, response.data.errorDescription);
          throw new Error(`Login failed: ${response.data.error} - ${response.data.errorDescription || ''}`);
        }

        this.accessToken = response.data.accessToken;
        console.log('Login successful, access token received (length:', this.accessToken.length, ')');
        
        // Set expiry to 1 hour before actual expiry for safety
        const expiresIn = response.data.expiresIn || 3600;
        this.tokenExpiry = new Date(Date.now() + (expiresIn - 300) * 1000);

        // Verify accessToken is set before calling getUserEnvironment
        if (!this.accessToken) {
          console.error('ERROR: accessToken is null after assignment!');
          throw new Error('Access token was not set after login');
        }

        // Get user environment after login - this is critical for API calls
        console.log('Retrieving user environment with access token...');
        await this.getUserEnvironment();
        
        if (!this.userCustomerID) {
          console.error('CRITICAL: UserCustomerID not retrieved. Tracking API calls will fail.');
          throw new Error('Failed to retrieve UserCustomerID. This is required for API calls.');
        }
        
        console.log('Login and user environment setup complete. UserCustomerID:', this.userCustomerID);
      } catch (error: any) {
        console.error('Malca-Amit login error:', {
          message: error.message,
          response: error.response?.data,
          status: error.response?.status,
          statusText: error.response?.statusText,
        });
        // Reset state on error
        this.accessToken = null;
        this.userCustomerID = null;
        this.tokenExpiry = null;
        const errorMessage = error.response?.data?.message || error.message || 'Unknown error';
        throw new Error(`Failed to login to Malca-Amit API: ${errorMessage}`);
      } finally {
        this.loginPromise = null;
      }
    })();

    return this.loginPromise;
  }

  /**
   * Get user environment to get UserCustomerID
   */
  async getUserEnvironment(): Promise<void> {
    if (!this.accessToken) {
      console.error('getUserEnvironment called but accessToken is null');
      throw new Error('Not authenticated. Please login first.');
    }

    console.log(`Calling getUserEnvironment with token: ${this.accessToken.substring(0, 20)}...`);

    try {
      const response = await axios.get<any>(
        `${this.baseURL}/api/users/userEnvironment`,
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      // Log the full response to understand the structure
      console.log('UserEnvironment response:', JSON.stringify(response.data, null, 2));

      // Extract UserCustomerID from response - it's nested in defaultCustomer, lastUsedCustomer, or connectedCustomers
      const data = response.data;
      
      // Try to get from defaultCustomer first (most reliable)
      this.userCustomerID = 
        data?.defaultCustomer?.userCustomerID?.toString() ||
        data?.defaultCustomer?.userCustomerId?.toString() ||
        // Try lastUsedCustomer
        data?.lastUsedCustomer?.userCustomerID?.toString() ||
        data?.lastUsedCustomer?.userCustomerId?.toString() ||
        // Try first connected customer
        (data?.connectedCustomers && Array.isArray(data.connectedCustomers) && data.connectedCustomers.length > 0 
          ? (data.connectedCustomers[0]?.userCustomerID?.toString() || data.connectedCustomers[0]?.userCustomerId?.toString())
          : null) ||
        // Fallback to top-level (in case API structure changes)
        data?.userCustomerID?.toString() || 
        data?.userCustomerId?.toString() || 
        data?.UserCustomerID?.toString() ||
        data?.UserCustomerId?.toString() ||
        null;

      if (!this.userCustomerID) {
        console.error('UserCustomerID not found in environment response. Full response:', JSON.stringify(data, null, 2));
        throw new Error('UserCustomerID not found in API response. This is required for tracking API calls.');
      }

      console.log(`Successfully retrieved UserCustomerID: ${this.userCustomerID}`);
    } catch (error: any) {
      console.error('Malca-Amit getUserEnvironment error:', error.response?.data || error.message);
      throw new Error(`Failed to get user environment: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Get tracking information for a shipment
   */
  async getTracking(shipmentNumber: string): Promise<TrackingStatus[]> {
    try {
      // Ensure we're authenticated and have UserCustomerID
      if (!this.accessToken || !this.tokenExpiry || new Date() >= this.tokenExpiry || !this.userCustomerID) {
        await this.login();
      }

      // UserCustomerID is required - fail if we don't have it
      if (!this.userCustomerID) {
        throw new Error('UserCustomerID is required but not available. Cannot make tracking API call.');
      }

      const headers: Record<string, string> = {
        Authorization: `Bearer ${this.accessToken!}`,
        'Content-Type': 'application/json',
        UserCustomerID: this.userCustomerID, // This is required
      };

      const response = await axios.get<TrackingResponse>(
        `${this.baseURL}/api/Tracking/${shipmentNumber}`,
        { headers }
      );

      // Log the full response to understand the structure (only in development)
      if (process.env.NODE_ENV !== 'production') {
        console.log(`Tracking API response for ${shipmentNumber}:`, JSON.stringify(response.data, null, 2));
      }

      // Transform API response to our TrackingStatus format
      const statusHistory: TrackingStatus[] = [];
      const data = response.data;

      // Malca-Amit API returns data with "steps" array and "latestStatus"
      if (data.steps && Array.isArray(data.steps) && data.steps.length > 0) {
        // Parse each step in the tracking history
        data.steps.forEach((step: any) => {
          // Parse the date string (format: "30/12/2025 09:14" or "30/12/2025 03:44")
          let timestamp = new Date();
          try {
            // Try UTC time first, then local time
            const timeStr = step.recordingTimeUTC || step.recordingTime;
            if (timeStr) {
              // Parse format: "30/12/2025 03:44" (DD/MM/YYYY HH:mm)
              const parts = timeStr.split(' ');
              if (parts.length === 2) {
                const [datePart, timePart] = parts;
                const [day, month, year] = datePart.split('/');
                const [hour, minute] = timePart.split(':');
                // Create date in UTC if recordingTimeUTC, otherwise local
                if (step.recordingTimeUTC) {
                  timestamp = new Date(Date.UTC(
                    parseInt(year),
                    parseInt(month) - 1,
                    parseInt(day),
                    parseInt(hour),
                    parseInt(minute)
                  ));
                } else {
                  timestamp = new Date(
                    parseInt(year),
                    parseInt(month) - 1,
                    parseInt(day),
                    parseInt(hour),
                    parseInt(minute)
                  );
                }
              }
            }
          } catch (e) {
            console.warn(`Failed to parse timestamp for step: ${step.recordingTime || step.recordingTimeUTC}`, e);
          }

          // Build location string from origin/destination if available
          let location: string | undefined = undefined;
          if (data.originCity && data.originCountry) {
            location = `${data.originCity}, ${data.originCountry}`;
          }
          if (data.destinationCity && data.destinationCountry && step.stepActionID >= 500) {
            location = `${data.destinationCity}, ${data.destinationCountry}`;
          }

          statusHistory.push({
            status: step.stepDesciption || step.stepDescription || step.description || 'Unknown', // Note: API has typo "stepDesciption"
            timestamp: timestamp,
            location: location,
            description: step.stepDesciption || step.stepDescription || null, // Use step description as description
          });
        });

        // Add latest status as the first entry if it's different from the last step
        if (data.latestStatus && statusHistory.length > 0) {
          const lastStatus = statusHistory[statusHistory.length - 1].status;
          if (data.latestStatus !== lastStatus) {
            // Parse latest update time
            let latestTimestamp = new Date();
            try {
              const latestTimeStr = data.latestUpdateTimeUTC || data.latestUpdateTime;
              if (latestTimeStr) {
                const parts = latestTimeStr.split(' ');
                if (parts.length === 2) {
                  const [datePart, timePart] = parts;
                  const [day, month, year] = datePart.split('/');
                  const [hour, minute] = timePart.split(':');
                  if (data.latestUpdateTimeUTC) {
                    latestTimestamp = new Date(Date.UTC(
                      parseInt(year),
                      parseInt(month) - 1,
                      parseInt(day),
                      parseInt(hour),
                      parseInt(minute)
                    ));
                  } else {
                    latestTimestamp = new Date(
                      parseInt(year),
                      parseInt(month) - 1,
                      parseInt(day),
                      parseInt(hour),
                      parseInt(minute)
                    );
                  }
                }
              }
            } catch (e) {
              console.warn(`Failed to parse latest update time: ${data.latestUpdateTime || data.latestUpdateTimeUTC}`, e);
            }

            statusHistory.push({
              status: data.latestStatus,
              timestamp: latestTimestamp,
              location: data.destinationCity && data.destinationCountry 
                ? `${data.destinationCity}, ${data.destinationCountry}` 
                : undefined,
              description: data.latestStatus,
            });
          }
        }
      } else if (data.latestStatus) {
        // Fallback: if no steps array, use latestStatus
        let timestamp = new Date();
        try {
          const latestTimeStr = data.latestUpdateTimeUTC || data.latestUpdateTime || data.deliveryTimeUTC || data.deliveryTime;
          if (latestTimeStr) {
            const parts = latestTimeStr.split(' ');
            if (parts.length === 2) {
              const [datePart, timePart] = parts;
              const [day, month, year] = datePart.split('/');
              const [hour, minute] = timePart.split(':');
              if (data.latestUpdateTimeUTC || data.deliveryTimeUTC) {
                timestamp = new Date(Date.UTC(
                  parseInt(year),
                  parseInt(month) - 1,
                  parseInt(day),
                  parseInt(hour),
                  parseInt(minute)
                ));
              } else {
                timestamp = new Date(
                  parseInt(year),
                  parseInt(month) - 1,
                  parseInt(day),
                  parseInt(hour),
                  parseInt(minute)
                );
              }
            }
          }
        } catch (e) {
          console.warn(`Failed to parse timestamp`, e);
        }

        statusHistory.push({
          status: data.latestStatus,
          timestamp: timestamp,
          location: data.destinationCity && data.destinationCountry 
            ? `${data.destinationCity}, ${data.destinationCountry}` 
            : (data.originCity && data.originCountry 
              ? `${data.originCity}, ${data.originCountry}` 
              : undefined),
          description: data.latestStatus,
        });
      }

      // Sort by timestamp (newest first)
      statusHistory.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

      return statusHistory;
    } catch (error: any) {
      console.error(`Malca-Amit getTracking error for ${shipmentNumber}:`, error.response?.data || error.message);
      
      // If it's a 404, return empty array (tracking not found)
      if (error.response?.status === 404) {
        return [];
      }

      throw new Error(
        `Failed to get tracking for ${shipmentNumber}: ${error.response?.data?.message || error.message}`
      );
    }
  }

  /**
   * Get latest status for a shipment (returns the most recent status)
   */
  async getLatestStatus(shipmentNumber: string): Promise<string> {
    const statusHistory = await this.getTracking(shipmentNumber);
    if (statusHistory.length === 0) {
      return 'Not Found';
    }
    return statusHistory[0].status;
  }
}

export const malcaAmitService = new MalcaAmitService();

