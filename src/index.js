require("dotenv").config();

const express = require("express");
const path = require("path");
const rateLimit = require("express-rate-limit");
const color = require("cli-color")
const cors = require("cors");
const redis = require("./redis");

const RateLimit = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 min
    limit: 30,
    standardHeaders: "draft-6",
    legacyHeaders: true,
    handler: (req, res) => {
        res.status(429).json({ success: false, message: "Too Many Requests", error: "You are currently ratelimited." })
    },
    validate: { xForwardedForHeader: false }
})

const Server = express();
Server.disable("x-powered-by")
Server.use(express.json());
Server.use(RateLimit);
Server.use(cors({
    origin: "*",
    credentials: false
}))

const RedisServer = new redis(Server);

const Fields = ["volume", "brightness", "model", "battery", "version", "lastUpdated"];

Server.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "client", "index.html"));
});


Server.post("/phone", async (req, res) => {
    if (!req.headers["x-api-key"] || req.headers["x-api-key"] !== process.env.API_KEY) {
        console.warn(color.blueBright(`[SERVER (API)]: SERVER ACCESS ATTEMPT WAS MADE, ROUTE: /phone, METHOD: POST, IP: ${req.headers["x-forwarded-for"] || req.ip}`));
        return res.status(401).json({ success: false, message: "Unauthorized", error: "You do not have access to this endpoint, your IP has been logged." });
    };

    console.log(req.body);

    const Missing = Fields.filter(Key => !(Key in req.body));

    if (Missing.length > 0) {
        return res.status(400).json({ success: false, message: "Bad Requst", error: `Missing required data fields.` });
    }

    const entriesToSet = Fields
        .filter(field => field in req.body)
        .flatMap(field => [field, req.body[field]]);

    await RedisServer.Redis.mSet(entriesToSet);
    await RedisServer.Redis.set("lastUpdated", new Date().toISOString())

    return res.status(200).json({ success: true, message: "OK" })
})

Server.get("/phone", async (req, res) => {
    const Values = await RedisServer.Redis.mGet(Fields);

    const Data = {};
    Fields.forEach((field, i) => {
        Data[field] = Values[i];
    });

    return res.status(200).json({ success: true, message: "OK", data: Data })
})

Server.listen(150, () => {
    RedisServer.Connect().then((async) => {
        console.log(color.green("[STARTUP]: Successfully connected to Redis and launched server on port 150"))
    })
})