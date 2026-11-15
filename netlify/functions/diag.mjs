export default async () => {
  const v = process.env.APP_UNLOCK_PASSWORD;
  return Response.json({
    variavel_definida: !!v,
    comprimento: v ? v.length : 0,
    primeiro_caracter: v ? v[0] : null,
    ultimos_2: v ? v.slice(-2) : null,
    contexto: process.env.CONTEXT || null,
  });
};
