window.theiaCloudConfig = {
  appId: 'nJV3nKZmpxTD4wu2',
  appName: 'Theia Blueprint',
  // Set to false for demo/development mode without Keycloak server
  // Set to true when you have a real Keycloak instance running
  useKeycloak: false,
  serviceUrl: 'http://localhost:8081/service',
  appDefinition: 'ghcr.io/ls1intum/theia/java-17:latest',
  useEphemeralStorage: true,
  pageTitle: 'TUM Theia Cloud',
  additionalApps: [
    {
      appId: "c-latest",
      appName: "C",
      buildSystems: [
        { id: "makefile", label: "Makefile"}
      ]
    },
    {
      appId: "java-17-latest", 
      appName: "Java",
      image: "java-17",
      buildSystems: [
        { id: "maven", label: "Maven" },
        { id: "gradle", label: "Gradle "},
      ]
    },
    {
      appId: "javascript-latest",
      appName: "Javascript",
      buildSystems: [
        { id: "npm", label: "npm"}
      ]
    },
    {
      appId: "ocaml-latest",
      appName: "Ocaml",
      buildSystems: [
        { id: "dune", label: "Dune"}
      ]
    },
    {
      appId: "python-latest",
      appName: "Python",
      buildSystems: [
        { id: "pip", label: "pip"}
      ]
    },
    {
      appId: "rust-latest",
      appName: "Rust",
      buildSystems: [
        { id: "cargo", label: "Cargo"}
      ]
    }
  ],
  disableInfo: true,
  infoText: '',
  infoTitle: '',
  loadingText: 'Preparing your personal Online IDE...',
  logoFileExtension: 'png',
  // Footer links configuration
  // All footer links are optional - if not provided, default values will be used
  footerLinks: {
    attribution: {
      text: 'Built by TUM AET Team 👨‍💻',
      url: 'https://aet.cit.tum.de/',
      version: 'v1.0.0'
    },
    bugReport: {
      text: 'Report a bug',
      url: 'https://github.com/EduIDE/EduIDE-Cloud/issues'
    },
    featureRequest: {
      text: 'Request a feature',
      url: 'https://github.com/EduIDE/EduIDE-Cloud/issues'
    },
    about: {
      text: 'About',
      url: 'https://aet.cit.tum.de/'
    }
  },
  // Keycloak configuration - only used when useKeycloak: true
  // For development, you can use a local Keycloak or minikube setup
  // Example: "https://192.168.59.101.nip.io/keycloak" for minikube
  keycloakAuthUrl: "http://localhost:8080/auth/",
  keycloakRealm: "TheiaCloud",
  keycloakClientId: "theia-cloud",
};
