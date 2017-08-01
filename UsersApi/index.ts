import { createAzureFunctionHandler } from "azure-function-express";
import * as express from "express";

// Create express app as usual
const app = express();
app.get("/api/:foo", (req, res) => res.json({
  ok: "OK",
}));
app.get("/api/:foo/:bar", (req, res) => res.json({ foo: req.params.foo, bar: req.params.bar }));

// Binds the express app to an Azure Function handler
module.exports = createAzureFunctionHandler(app);
