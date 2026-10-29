// Limites da app (um só sítio para mudar).
// Favoritos: máximo por tipo de média. É aplicado ao adicionar (ver toggleFavorite no App);
// favoritos que já excedam o limite continuam visíveis até serem removidos.
export const MAX_FAVORITES_PER_TYPE = 7;

// Hall of Fame: máximo de obras (PC e telemóvel: 5 × 2). Ao baixar o limite, as obras a mais
// não se apagam: ficam guardadas mas escondidas, e voltam a aparecer se o limite subir.
export const MAX_HALL_OF_FAME = 10;
