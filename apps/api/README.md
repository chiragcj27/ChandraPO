# ChandraPO API

Backend API service built with Node.js, Express, and TypeScript.

## Getting Started

### Prerequisites

- Node.js >= 18.0.0
- npm or yarn

### Installation

```bash
npm install
```

### Development

Run the development server with hot reload:

```bash
npm run dev
```

The server will start on `http://localhost:4000`

### Build

Compile TypeScript to JavaScript:

```bash
npm run build
```

### Production

Run the compiled JavaScript:

```bash
npm start
```

## Available Endpoints

- `GET /health` - Health check endpoint
- `GET /api` - API information

## Environment Variables

Create a `.env` file in the root directory:

```env
PORT=4000
NODE_ENV=development
```

## Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run type-check` - Run TypeScript type checking
- `npm run lint` - Run ESLint

## Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Language**: TypeScript
- **Dev Tools**: tsx for hot reload

