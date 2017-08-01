import { createAzureFunctionHandler } from "azure-function-express";
import * as express from "express";

const app = express();

app.get("/api/debug", (req, res) => {
  res.json({
    env: process.env,
    headers: req.headers,
  });
});

app.get("/api/:foo/:bar", (req, res) => res.json({ foo: req.params.foo, bar: req.params.bar }));

// Binds the express app to an Azure Function handler
module.exports = createAzureFunctionHandler(app);
