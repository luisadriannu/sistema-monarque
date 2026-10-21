export interface EventData {
  tipo?: string;
  plan?: string;
  seo?: {
    title?: string;
    description?: string;
    image?: string;
  };
  event: {
    name: string;
    date: string;
    startsAt?: string;
    ceremonyHour?: string;
    partyHour?: string;
    phrase?: string;
    dressCode?: string;
    itinerary?: { hour: string; title: string; description?: string }[];
  };
  media: {
    coverImage: string;
    gallery: string[];
  };
  location: {
    event?: string;
    reception: string;
  };
  contact?: {
    phone?: string;
  };
  family?: {
    groomParents?: { father: string; mother: string };
    brideParents?: { father: string; mother: string };
  };
  design?: {
    variant?: string;
    colors?: {
      primary?: string;
      secondary?: string;
      accent?: string;
      background?: string;
    };
  };
}
