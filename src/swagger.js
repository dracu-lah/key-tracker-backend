// backend/src/swagger.js
const swaggerUi = require("swagger-ui-express");
const swaggerJsdoc = require("swagger-jsdoc");
const path = require("path");
const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Key Management API",
      version: "1.0.0",
      description: "API for managing keys and user assignments",
    },
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  apis: [path.join(__dirname, "routes/*.js")], // Ensure correct path
};

const specs = swaggerJsdoc(options);

module.exports = (app) => {
  app.use("/docs", swaggerUi.serve, swaggerUi.setup(specs));
};
