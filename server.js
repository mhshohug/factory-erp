const express = require("express");
const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

const DATA_DIR = path.join(__dirname, "data/current");

/* ================= HELPERS ================= */
function readTable(file) {
    const p = path.join(DATA_DIR, file);
    if (!fs.existsSync(p)) return [];
    const html = fs.readFileSync(p, "utf8");
    const $ = cheerio.load(html);
    let rows = [];
    $("table tr").each((i, tr) => {
        let cols = [];
        $(tr).find("td").each((j, td) => { cols.push($(td).text().trim()); });
        if (cols.length > 5) rows.push(cols);
    });
    return rows;
}

function normalizeDate(q) {
    const months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
    const now = new Date();
    if (/today|aj|ajke/.test(q)) return `${now.getDate()}-${months[now.getMonth()]}`;
    let m = q.match(/(\d{1,2})\s*(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/);
    if (m) return `${m[1]}-${m[2]}`;
    return null;
}

function detectProcess(q) {
    if (q.includes("cpb")) return "cpb";
    if (q.includes("jet")) return "jet";
    if (q.includes("jigger")) return "jigger";
    if (q.includes("rolling")) return "rolling";
    if (q.includes("singing")) return "singing";
    if (q.includes("marcerise") || q.includes("merc")) return "marcerise";
    return "all";
}

const colMap = {
    "Singing.html": 8, "Marcerise.html": 8, "CPB.html": 6,
    "Jet.html": 6, "Jigger.html": 7, "Rolling.html": 7
};

/* ================= SEARCH LOGIC ================= */
app.post("/ask", (req, res) => {
    const q = (req.body.question || "").toLowerCase().trim();
    const date = normalizeDate(q);
    const process = detectProcess(q);
    const isTotal = q.includes("total") || q.includes("totall");

    // ১. Sill Search Mode
    let sMatch = q.match(/sill\s*(\d+)/);
    if (sMatch) {
        const sill = sMatch[1];
        const gTable = readTable("GREY ENTRY.html");
        const g = gTable.find(r => r[2] === sill);
        if (!g) return res.json({ reply: `Sill ${sill} পাওয়া যায়নি।` });

        let reply = `📊 **Sill Report: ${sill}**\n━━━━━━━━━━━━━━━━\n👤 **Party:** ${g[3]}\n📜 **Quality:** ${g[4]}\n🏗️ **Cons:** ${g[5]}\n📦 **Lot:** ${g[6]} yds\n\n⚙️ **Status:**\n`;
        let totalDye = 0;
        
        for (const [file, idx] of Object.entries(colMap)) {
            const sum = readTable(file).filter(r => r[1] === sill).reduce((s, r) => s + (parseFloat(r[idx].replace(/,/g, "")) || 0), 0);
            reply += `${file.split('.')[0]}: ${Math.round(sum)} yds\n`;
            if (file.match(/CPB|Jet|Jigger/)) totalDye += sum;
        }
        reply += `\n📊 **Total Dyeing:** ${Math.round(totalDye)} yds`;
        return res.json({ reply });
    }

    // ২. Total Mode (Grand Total or Specific Process Total)
    if (isTotal) {
        let reply = `📉 **Grand Total Production**\n━━━━━━━━━━━━━━━━\n`;
        let grandTotalDye = 0;

        for (const [file, idx] of Object.entries(colMap)) {
            const sum = readTable(file).reduce((s, r) => s + (parseFloat(r[idx].replace(/,/g, "")) || 0), 0);
            const pName = file.split('.')[0].toLowerCase();
            if (process === "all" || process === pName) {
                reply += `${file.split('.')[0]}: ${Math.round(sum)} yds\n`;
                if (file.match(/CPB|Jet|Jigger/)) grandTotalDye += sum;
            }
        }
        if (process === "all") reply += `\n📊 **Total Dyeing:** ${Math.round(grandTotalDye)} yds`;
        return res.json({ reply });
    }

    // ৩. Date Mode (Daily Summary or Daily Process-specific)
    if (date) {
        let reply = `📅 **Production Report: ${date}**\n━━━━━━━━━━━━━━━━\n`;
        let dayDye = 0;

        for (const [file, idx] of Object.entries(colMap)) {
            const sum = readTable(file).filter(r => r[0].toLowerCase().includes(date)).reduce((s, r) => s + (parseFloat(r[idx].replace(/,/g, "")) || 0), 0);
            const pName = file.split('.')[0].toLowerCase();
            if (process === "all" || process === pName) {
                reply += `${file.split('.')[0]}: ${Math.round(sum)} yds\n`;
                if (file.match(/CPB|Jet|Jigger/)) dayDye += sum;
            }
        }
        if (process === "all") reply += `\n📊 **Total Dyeing:** ${Math.round(dayDye)} yds`;
        return res.json({ reply });
    }

    res.json({ reply: "লিখুন: 'sill 590', '1 feb', 'today cpb', 'total jet' বা 'total'" });
});

app.listen(3000, () => console.log("ERP Server Running on 3000"));
