# EduIDE Landing Page

Landing page for EduIDE Cloud workspace management, providing a user-friendly interface for launching cloud-based development environments.

## Features

- **User Authentication**: Keycloak-based authentication and authorization
- **Workspace Management**: Launch and manage multiple cloud-based IDEs
- **Dynamic Configuration**: Runtime configuration via `config.js`
- **Query Parameters**: Support for various URL parameters (gitUri, gitToken, artemisToken, etc.)
- **Responsive Design**: Modern UI with dark/light theme support
- **3D Background**: Interactive Vanta.js animated background

## Prerequisites

- **Node.js**: >= 20.0.0
- **npm**: Latest stable version
- **Docker** (for containerized deployment): Docker with Buildx support for multi-arch builds

## Quick Start

### Local Development

```bash
# Clone the repository
git clone https://github.com/EduIDE/EduIDE-Landing-Page.git
cd EduIDE-Landing-Page

# Install dependencies
npm install

# Start development server
npm run dev
```

The landing page will be available at `http://localhost:5173`

### Build for Production

```bash
# Build the application
npm run build

# Preview the production build
npm run preview
```

The built files will be in the `dist/` directory.

### Docker Deployment

```bash
# Build the Docker image
docker build -t ghcr.io/EduIDE/eduidec-landing-page:latest .

# Run the container
docker run -d -p 80:80 ghcr.io/EduIDE/eduidec-landing-page:latest
```

## Configuration

The landing page is configured via `public/config.js`. Create or modify this file to set up your environment:

```javascript
window.theiaCloudConfig = {
  // Basic configuration
  serviceAuthToken: "your-service-auth-token",
  appName: "EduIDE",
  serviceUrl: "https://your-theia-cloud-instance.com",
  appDefinition: "your-app-definition",
  useKeycloak: true,
  useEphemeralStorage: true,

  // Keycloak configuration (if useKeycloak is true)
  keycloakAuthUrl: "https://your-keycloak-instance.com/auth",
  keycloakRealm: "your-realm",
  keycloakClientId: "your-client-id",

  // Landing page options
  disableInfo: false,
  infoTitle: "Welcome to EduIDE",
  infoText: "Your cloud-based IDE for education",
  loadingText: "Loading your workspace...",
  logoFileExtension: "png",
  pageTitle: "EduIDE Cloud",
  sentryEnable: true,
  sentryEnvironment: "production",
  // Optional override. If omitted, the default EduIDE Sentry DSN is used.
  sentryDsn: "https://examplePublicKey@sentry.example.com/123",

  // Additional apps to display
  additionalApps: [
    {
      serviceAuthToken: "app1-token",
      appName: "Python Environment"
    },
    {
      serviceAuthToken: "java-17-no-ls",
      appName: "Java 17 No-LS",
      image: "java-17"
    }
  ]
};
```

### Configuration Options

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `serviceAuthToken` | string | Yes | Service authentication token |
| `appName` | string | Yes | Application name |
| `serviceUrl` | string | Yes | Theia Cloud service URL |
| `appDefinition` | string | Yes | Application definition identifier |
| `useKeycloak` | boolean | Yes | Enable Keycloak authentication |
| `useEphemeralStorage` | boolean | Yes | Use ephemeral storage for workspaces |
| `keycloakAuthUrl` | string | Conditional | Keycloak auth server URL |
| `keycloakRealm` | string | Conditional | Keycloak realm name |
| `keycloakClientId` | string | Conditional | Keycloak client ID |
| `disableInfo` | boolean | No | Disable info banner |
| `infoTitle` | string | No | Info banner title |
| `infoText` | string | No | Info banner text |
| `loadingText` | string | No | Loading message text |
| `logoFileExtension` | string | No | Logo file extension (png, svg, etc.) |
| `sentryEnable` | boolean | No | Enable Sentry browser monitoring |
| `sentryEnvironment` | string | No | Sentry environment tag, e.g. namespace or deployment name |
| `sentryDsn` | string | No | Override the default EduIDE Sentry DSN |
| `additionalApps` | array | No | Additional apps to display |
| `footerLinks` | object | No | Footer link configuration |

Each entry in `additionalApps` may optionally include `image` (or `Image` for compatibility). When omitted, the landing page keeps the current behavior and derives the logo path from `appName`. When provided, the landing page uses that value instead:

- Plain name like `java-17` becomes `/assets/logos/java-17-logo.png`
- Filename like `java-17-logo.png` becomes `/assets/logos/java-17-logo.png`
- Absolute path like `/custom/logo.png` is used as-is

## Query Parameters

The landing page supports various URL query parameters to pre-configure the session:

| Parameter | Type | Description |
|-----------|------|-------------|
| `appDef` | string | Application definition to launch |
| `gitUri` | string | Git repository URL to clone |
| `gitUser` | string | Git username for authentication |
| `gitMail` | string | Git email for authentication |
| `gitToken` | string | Git authentication token |
| `artemisUrl` | string | Artemis service URL |
| `artemisToken` | string | Artemis authentication token |

Example: `https://your-landing-page.com/?appDef=myapp&gitUri=https://github.com/user/repo.git`

## NPM Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |
| `npm run typecheck` | Run TypeScript type checking |
| `npm run lint` | Run ESLint linter |
| `npm run lint:fix` | Auto-fix linting issues |
| `npm run format` | Format code with Prettier |
| `npm run format:check` | Check code formatting |

## Keycloak Setup

To enable Keycloak authentication:

1. Create a Keycloak client in your Keycloak instance
2. Configure the client with the following settings:
   - **Client Protocol**: openid-connect
   - **Access Type**: confidential or public (depending on your setup)
   - **Valid Redirect URIs**: Your landing page URL (e.g., `http://localhost:5173/*` for dev)
   - **Web Origins**: Your landing page URL
3. Update `public/config.js` with your Keycloak configuration

## Development Guide

### Project Structure

```
EduIDE-Landing-Page/
├── src/
│   ├── components/          # React components
│   │   ├── AppLogo.tsx
│   │   ├── ErrorComponent.tsx
│   │   ├── Footer.tsx
│   │   ├── Header.tsx
│   │   ├── Imprint.tsx
│   │   ├── Info.tsx
│   │   ├── LaunchApp.tsx
│   │   ├── Loading.tsx
│   │   ├── LoginButton.tsx
│   │   ├── Privacy.tsx
│   │   ├── SelectApp.tsx
│   │   ├── Spinner.tsx
│   │   ├── ThemeToggle.tsx
│   │   └── VantaBackground.tsx
│   ├── contexts/            # React contexts
│   │   └── ThemeContext.tsx
│   ├── App.tsx              # Main application component
│   ├── App.css              # Application styles
│   └── main.tsx             # Entry point
├── public/                  # Static assets
│   ├── assets/              # Images, logos, etc.
│   ├── config.js            # Runtime configuration
│   └── favicon.ico
├── .github/workflows/       # CI/CD workflows
│   └── docker-build.yml
├── Dockerfile               # Multi-stage Docker build
├── nginx.conf               # Nginx configuration
├── vite.config.ts           # Vite build configuration
├── tsconfig.json            # TypeScript configuration
└── package.json             # Project dependencies
```

### Adding New Features

1. **Add React Components**: Place in `src/components/`
2. **Update Configuration**: Modify `public/config.js` for runtime changes
3. **Add Dependencies**: Add to `package.json` and run `npm install`
4. **Update Styles**: Modify `src/App.css` or component-specific CSS files

### Troubleshooting

**Build Fails with TypeScript Errors**:
```bash
# Check TypeScript errors
npm run typecheck
```

**Lint Errors**:
```bash
# Auto-fix linting issues
npm run lint:fix
```

**Docker Build Fails**:
- Ensure Docker daemon is running
- Check Node.js version (>= 20.0.0)
- Verify `package-lock.json` is present

**404 Errors in Production**:
- Ensure `base` path in `vite.config.ts` matches your deployment path
- Check nginx.conf routing configuration

## CI/CD

This project uses GitHub Actions for automated Docker builds and multi-architecture support.

### Workflow Triggers

- **Push to main**: Builds and pushes to `latest` tag
- **Pull Request**: Builds image for testing
- **Manual Dispatch**: Build on demand with version tag

### Build Platforms

- `linux/amd64`
- `linux/arm64`

### Image Registry

Built images are pushed to: `ghcr.io/EduIDE/eduidec-landing-page`

## License

EPL-2.0 OR GPL-2.0 WITH Classpath-exception-2.0

## Contributing

Contributions are welcome! Please follow these guidelines:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Support

For issues and questions:
- **GitHub Issues**: https://github.com/EduIDE/EduIDE-Landing-Page/issues
- **Documentation**: [EduIDE Docs](https://EduIDE.github.io/Docs)

## Related Projects

- [EduIDE-Cloud](https://github.com/EduIDE/EduIDE-Cloud): Main EduIDE Cloud project
- [EduIDE-deployment](https://github.com/EduIDE/EduIDE-deployment): Kubernetes deployment for EduIDE Cloud
