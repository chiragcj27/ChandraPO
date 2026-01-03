# Client Login Setup Guide

## Overview
Client users can only **view** their own POs (read-only access). Only admins can review, edit, and manage POs.

## Creating Client Users

### Step 1: Ensure Client Exists
First, make sure the client exists in the database. Default clients are seeded automatically, or you can create them via the admin interface.

To see available clients, you can:
- Check the database directly
- Use the admin dashboard to view clients
- Or check the seed file: `apps/backend/src/seed/clients.ts`

### Step 2: Create Client User Account

Use the seed script to create a client user:

```bash
cd apps/backend
npm run seed:client-user -- <email> <password> <clientName>
```

**Example:**
```bash
npm run seed:client-user -- client@example.com password123 "Uneek"
```

**Notes:**
- `<email>`: The login email for the client user
- `<password>`: The password for the client user
- `<clientName>`: Must match exactly with an existing client name in the database (case-sensitive)

The script will:
1. Check if the client exists
2. Show available clients if not found
3. Create the user account linked to that client
4. Set the user role to "client"

### Step 3: Client Login

Once created, the client user can log in at:
```
http://localhost:3000/login
```

Using their email and password.

### What Clients Can Do:
✅ View their own POs (filtered by client name)
✅ View PO items in read-only mode
✅ Navigate through items
✅ Export completed items (if needed)

❌ Cannot upload POs
❌ Cannot edit/update PO items
❌ Cannot delete POs
❌ Cannot see other clients' POs

## Alternative: Using the Register API

You can also create client users via the API endpoint:

```bash
POST /auth/register
Content-Type: application/json

{
  "email": "client@example.com",
  "password": "password123",
  "role": "client",
  "clientId": "<client_id_from_database>",
  "name": "Client Name" (optional)
}
```

**Note:** You'll need the client's MongoDB `_id` for this method.

## Admin vs Client Users

| Feature | Admin | Client |
|---------|-------|--------|
| View all POs | ✅ | ❌ (only own) |
| Upload POs | ✅ | ❌ |
| Edit/Review POs | ✅ | ❌ (read-only) |
| Delete POs | ✅ | ❌ |
| Create users | ✅ | ❌ |
| View own POs | ✅ | ✅ |
| View PO items | ✅ | ✅ (read-only) |


