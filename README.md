# Depreciation & Cost Segregation Calculator

A comprehensive React application for calculating property depreciation using MACRS, bonus depreciation, and Section 179 deductions. Features cost segregation analysis for real estate investments.

## Features

- **MACRS Depreciation**: Calculate depreciation using Modified Accelerated Cost Recovery System
- **Bonus Depreciation**: Apply bonus depreciation rates based on year placed in service
- **Section 179 Deduction**: Immediate expense election for qualifying property
- **Cost Segregation**: Allocate property costs across different asset categories
- **Multiple Property Types**: Support for commercial (39-year) and residential (27.5-year) properties
- **Depreciation Methods**: MACRS (accelerated) or straight-line depreciation

## Asset Categories

- Land (Non-Depreciable)
- 5-Year Property (Appliances, carpeting, certain equipment)
- 7-Year Property (Furniture, fixtures, office equipment)
- 15-Year Property (Land improvements, landscaping, parking lots)
- Residential (27.5-year) - Residential rental property structures
- Commercial (39-year) - Nonresidential real property

## Getting Started

### Prerequisites

- Node.js 18+ and npm

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

The app will be available at `http://localhost:5173`

### Build

```bash
npm run build
```

### Preview Production Build

```bash
npm run preview
```

## Deployment

This project is configured for deployment on Vercel. Simply connect your GitHub repository to Vercel and it will automatically deploy.

## License

MIT
