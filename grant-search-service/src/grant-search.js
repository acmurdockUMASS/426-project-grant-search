import express, { response } from "express";

const PORT = process.env.PORT || 3000;
const DATA_DIR = process.env.DATA_DIR || "./data";
const INSTANCE_ID = process.env.INSTANCE_ID || "grant-search";
const ELIGIBILITY_AMBASSADOR_URL = process.env.ELIGIBILITY_AMBASSADOR_URL || "http://eligibility-ambassador:3000";
//const filepath = path.join(DATA_DIR, "grants.json");

const app = express();
app.use(express.json());

const grants = [
{ name: "Massachusetts Education Grant Opportunities for Student Success",
grantId: "13333",
deadlineStatus: "Ongoing",
fundingAmount: 10000,
regions: ["Massachusetts"],
requirements: ["501(c)(3)"],
interests: ["education"],
description: "Grant Opportunities to support educational improvement efforts across Massachusetts."},
{ name: "United States Humanitarian Grants",
grantId: "78641",
deadlineStatus: "Closed",
fundingAmount: 50000,
regions: ["United States"],
requirements: ["individual"],
interests: ["health", "humanities", "environment"],
description: "Grant Opportunities to support educational improvement efforts across Massachusetts."},
{ name: "North East Clean Up Grants",
grantId: "56733",
deadlineStatus: "Ongoing",
fundingAmount: 3000,
regions: ["Maine", "Vermont", "New Hampshire"],
requirements: ["501(c)(3)", "individual"],
interests: ["environment"],
description: "Grant Opportunities to help clean up areas underneath the Northeast Wilderness Trust."},
];

const delay = (ms) => new Promise((resolve)=>setTimeout(resolve,ms));

// Query Helper To Check for Query Parameters and ensure variables are arrays
const qHelper = (qIn) => {
    if(!qIn){return []} // No input is an empty array
    if(Array.isArray(qIn)){
        return qIn;
    }else{
        let out = [];
        out.push(qIn);
        return out;
    }
}
//GET /health
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "grant-search-service",
    instanceId: INSTANCE_ID,
  });
});
// GET /grants
app.get("/grants", async (req, res) => {
    await delay (450);
    const {
        grantStatus,
        amountRangeLow = 0,
        amountRangeHigh = Infinity,
        orgQueryRegion,
        orgQueryReq,
        orgQueryInterests,
    } = req.query;
    let orgRegion = qHelper(orgQueryRegion);
    let orgReq = qHelper(orgQueryReq);
    let orgInterests = qHelper(orgQueryInterests);
    const matches = grants.filter((grant) => {
        if(grantStatus && grant.deadlineStatus !== grantStatus){return false;}
        if(Number(amountRangeLow) > grant.fundingAmount){return false;}
        if(Number(amountRangeHigh) < grant.fundingAmount){return false;}
        if(orgRegion.length > 0 && 
        !orgRegion.some(region => grant.regions.includes(region))){return false;}
        if(orgReq.length > 0 && 
        !orgReq.some(req => grant.requirements.includes(req))){return false;}
        if(orgInterests.length > 0 && 
        !orgInterests.some(interest => grant.interests.includes(interest))){return false;}
        return true;
    });

    res.json({ count: matches.length, matches: matches });
});

    app.post("/eligibility-checks", async (req, res) => {
        try {
            const ambassadorResponse = await fetch(
                `${ELIGIBILITY_AMBASSADOR_URL}/eligibility-checks`,{
                    method: "POST",
                    headers: {
                        "content-type":  "application/json", 
                    },
                    body: JSON.stringify(req.body),
                },
            );
    const upstreamContentType =
      ambassadorResponse.headers.get("content-type") ||
      "application/json";

    const simulatedLatency =
      ambassadorResponse.headers.get("x-simulated-latency-ms");

    const upstreamBody = await ambassadorResponse.text();

    if (simulatedLatency) {
      res.set("x-simulated-latency-ms", simulatedLatency);
    }

    res.status(ambassadorResponse.status);
    res.set("content-type", upstreamContentType);

    return res.send(upstreamBody);
  } catch (error) {
    console.error("Cannot reach Eligibility Ambassador", error);

    return res.status(502).json({
      error: "Eligibility Ambassador unavailable",
    });
  }
});
app.listen(PORT, () => console.log(`Listening on port ${PORT}`));
