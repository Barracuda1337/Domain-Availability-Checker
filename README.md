# 🌐 Domain Availability Checker & Manager

A modern web application built with Next.js for checking domain availability, performing WHOIS queries, and managing domain portfolios.

![Next.js](https://img.shields.io/badge/Next.js-13.0-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.0-38B2AC)
![Prisma](https://img.shields.io/badge/Prisma-5.0-2D3748)

## ✨ Features

- 🔍 **Domain Availability Checking**
  - Single domain lookup
  - Bulk domain checking
  - WHOIS information retrieval
  
- 💾 **Domain Management**
  - Save interesting domains
  - View and manage saved domains
  - Delete saved domains
  
- 🎨 **Modern UI/UX**
  - Dark/Light theme support
  - Responsive design
  - Toast notifications
  - Clean and intuitive interface

## 🚀 Tech Stack

- **Frontend**: Next.js, TypeScript, Tailwind CSS, Radix UI
- **Backend**: Next.js API Routes
- **Database**: SQLite with Prisma ORM
- **State Management**: React Hooks
- **Styling**: Tailwind CSS + CSS Modules

## 📦 Installation

1. Clone the repository:
```bash
git clone https://github.com/Barracuda1337/Domain-Availability-Checker.git
cd Domain-Availability-Checker
```

2. Install dependencies:
```bash
npm install
```

3. Set up the database:
```bash
npx prisma generate
npx prisma db push
```

4. Configure environment variables:
   - Copy `.env.example` to `.env`
   - Update the values in `.env` with your API keys

5. Run the development server:
```bash
npm run dev
```

## 🛠️ Environment Variables

Create a `.env` file in the root directory with the following variables:

```env
# Database Configuration
DATABASE_URL="file:./dev.db"

# API Keys for WHOIS Services
# Get your API keys from respective services
JSONWHOIS_API_KEY=""
RAPIDAPI_KEY=""
WHOISFREAKS_API_KEY=""
```

> ⚠️ **Security Note**: 
> - Never commit your `.env` file to version control
> - Keep your API keys private and secure
> - Rotate your API keys periodically
> - Use environment variables for all sensitive data

## 📝 API Endpoints

- `/api/check-domain`: Check domain availability
- `/api/whois`: Get WHOIS information
- `/api/dns`: Get DNS records
- `/api/save-domain`: Save a domain
- `/api/saved-domains`: Manage saved domains

## 🔒 Security

This project uses several third-party APIs for domain checking. To use the application:

1. Sign up for API keys at:
   - [JSONWHOIS API](https://jsonwhois.com)
   - [RapidAPI - WHOIS API](https://rapidapi.com/apininjas/api/whois-by-api-ninjas)
   - [WHOISFreaks](https://whoisfreaks.com)

2. Add your API keys to the `.env` file
3. Never expose your API keys in the code or commit them to version control
4. Use environment variables for all sensitive data

## 🤝 Contributing

Contributions, issues, and feature requests are welcome! Feel free to check [issues page](https://github.com/Barracuda1337/Domain-Availability-Checker/issues).

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 👨‍💻 Author

**Barracuda1337**

- GitHub: [@Barracuda1337](https://github.com/Barracuda1337)

## 🌟 Show your support

Give a ⭐️ if this project helped you!
