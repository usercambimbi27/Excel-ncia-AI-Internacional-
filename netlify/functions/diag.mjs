export default async (req) => {
  const v = process.env.APP_UNLOCK_PASSWORD;
  const p = new URL(req.url).searchParams.get("p");
  return Response.json({
    variavel_definida: !!v,
    comprimento: v ? v.length : 0,
    comprimento_testado: p ? p.length : null,
    igual: p !== null && !!v && p === v,
  });
};
