// Demo records for exercising the Figma screens; these are not verified place listings.
export function createSeedData() {
  const spots = [
    {
      id: 'monte-croce', name: 'Monte Croce', locality: 'Treviso Bresciano, BS',
      description: 'Uno scorcio tra i sentieri e i boschi sopra Treviso Bresciano. Un posto per fermarsi, respirare e godersi il panorama.',
      latitude: 45.7, longitude: 10.46, photos: ['mountain', 'signpost', 'hiker'],
      ratings: { beauty: 3.5, privacy: 4.3, accessibility: 2.7, overall: 3.9 }, reviewCount: 2,
    },
    {
      id: 'radura-del-bosco', name: 'Radura del bosco', locality: 'Treviso Bresciano, BS',
      description: 'Un piccolo spazio aperto lungo il sentiero, immerso nel verde. Luogo dimostrativo per provare la mappa.',
      latitude: 45.712, longitude: 10.445, photos: ['hiker', 'mountain'],
      ratings: { beauty: 4.2, privacy: 4.5, accessibility: 3.3, overall: 4 }, reviewCount: 0,
    },
    {
      id: 'belvedere-sul-lago', name: 'Belvedere sul lago', locality: 'Idro, BS',
      description: 'Una sosta panoramica tra montagna e acqua. Luogo dimostrativo per provare ricerca e selezione.',
      latitude: 45.716, longitude: 10.479, photos: ['signpost', 'mountain'],
      ratings: { beauty: 4.8, privacy: 3.2, accessibility: 4, overall: 4 }, reviewCount: 0,
    },
  ];
  return {
    version: 2,
    users: [],
    sessions: [],
    spots,
    reviews: {
      'monte-croce': [
        { id: 'demo-scobe', author: { name: 'Scobe', avatar: 'scobe' }, text: 'bellissimo scorcio in mezzo alla foresta, raggiungibile in 30 minuti. consigliatissimo.', ratings: { beauty: 4, privacy: 4.6, accessibility: 3 }, createdAt: '2026-10-15T10:00:00.000Z' },
        { id: 'demo-mark', author: { name: 'Mark', avatar: 'mark' }, text: 'quanto mi piace salire in montagna vacca dio se mi gasa un botto, soprattuo quando c’è da tagliare la legna.', ratings: { beauty: 3, privacy: 4, accessibility: 2.4 }, createdAt: '2026-10-14T10:00:00.000Z' },
      ],
      'radura-del-bosco': [],
      'belvedere-sul-lago': [],
    },
    ratingTotals: Object.fromEntries(spots.map(spot => {
      const count = Math.max(1, spot.reviewCount);
      return [spot.id, { count, ...Object.fromEntries(Object.entries(spot.ratings).map(([key, value]) => [key, value * count])) }];
    })),
  };
}
