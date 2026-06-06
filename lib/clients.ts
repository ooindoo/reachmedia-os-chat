export const CLIENTS: Record<string, { id: string; name: string }> = {
  "Squale SA": {
    id: "3776285ec2068107a081e2158cfbe199",
    name: "Squale SA",
  },
  CappellettoShop: {
    id: "3776285ec2068153ae00f1dc2885fee0",
    name: "CappellettoShop",
  },
  Luxyt: {
    id: "3776285ec2068120bc01e1f6adad5c96",
    name: "Luxyt",
  },
  NOESI: {
    id: "3776285ec20681cb9f36ce19ef90a21d",
    name: "NOESI",
  },
  Opplant: {
    id: "3776285ec20681019c9ac2406b5564cb",
    name: "Opplant",
  },
  Markershop: {
    id: "3776285ec206816c867cca789001887f",
    name: "Markershop",
  },
  "Shirò Pagani Boutique": {
    id: "3776285ec20681aabaa0e7122a339b06",
    name: "Shirò Pagani Boutique",
  },
  Sicura: {
    id: "3776285ec2068100a82ac929b31aee2b",
    name: "Sicura",
  },
  "Stewart Dawson": {
    id: "3776285ec20681809ebfe1071b278795",
    name: "Stewart Dawson",
  },
  "Giuseppe Toniolo Airbnb": {
    id: "3776285ec20681e3bb7fda9dc29532d2",
    name: "Giuseppe Toniolo Airbnb",
  },
};

export const CLIENT_NAMES = Object.keys(CLIENTS);

export const TIPI_ATTIVITA = [
  "Newsletter",
  "Flow/Automation",
  "Shopify Dev",
  "Call/Meeting",
  "Report/Analytics",
  "Copy/Content",
  "Setup/Configurazione",
  "Fix/Bug",
  "Social/Meta",
  "Airbnb Messaggistica",
] as const;

export type TipoAttivita = (typeof TIPI_ATTIVITA)[number];

export const PRIORITA = [
  "🔴 Urgente",
  "🟡 Media",
  "🟢 Bassa",
] as const;

export type Priorita = (typeof PRIORITA)[number];
