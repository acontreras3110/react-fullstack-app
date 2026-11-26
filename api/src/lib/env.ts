export const env = {
  corsOrigins: (process.env.CORS_ORIGINS ?? "http://localhost:5173").split(","),
};
