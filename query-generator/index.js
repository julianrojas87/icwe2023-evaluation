import { Command } from "commander";
import fsPromise from "fs/promises";
import path from "path";
import { gunzip } from "zlib";
import { parse as wktParse } from 'wellknown';
import { Dijkstra, NBAStar, Utils } from "tiles-planner";

async function run() {
    const program = new Command()
        .requiredOption("--tiles <tiles>", "Tile interface URL")
        .requiredOption("-o, --output <output>", "File path where the output will be stored")
        .option("--min-rank <minRank>", "Minimum k for Dijkstra ranks DR=2^k (default: k=5)", 5)
        .option("--max-rank <maxRank>", "Maximum k for Dijkstra ranks DR=2^k (default: k=20)", 19)
        .option("--query-amount <queryAmount>", "Number of queries per rank (default: 10)", 10)
        .parse(process.argv);

    const output = path.resolve(program.opts().output);
    const minRank = parseInt(program.opts().minRank);
    const maxRank = parseInt(program.opts().maxRank);
    const queryAmount = parseInt(program.opts().queryAmount);
    const index = await loadIndex();
    
    // Use a Dijkstra planner 
    const planner = new Dijkstra({
        tilesBaseURL: program.opts().tiles,
        zoom: 12,
        distance: (node) => { return node.cost }
    });

    // Have a NBA* planner for verification
    const biPlanner = new NBAStar({
        tilesBaseURL: program.opts().tiles,
        zoom: 12,
        distance: (node) => { return node.cost },
        heuristic: Utils.harvesineDistance 
    });

    // Generate random queries for Dijkstra ranks given by 
    for (let i = minRank; i < maxRank; i++) {
        const DijkstraRank = Math.pow(2, i);
        console.log("Dijkstra Rank: ", DijkstraRank);

        for (let j = 0; j < queryAmount; j++) {
            const randomNode = index.get(getRandomKey(index));
            randomNode.coordinates = wktParse(randomNode.wkt).coordinates;

            try {
                const sp = await planner.findPath(randomNode, undefined, DijkstraRank);
                if (sp) {
                    // Clean up and complement query and result
                    sp.path.forEach(n => {
                        delete n.nextNodes;
                        delete n.prevNodes;
                        delete n.cost;
                    });
                    sp.from = sp.path[0];
                    sp.to = sp.path[sp.path.length - 1];

                    // Verify route
                    console.log("Verifying route...")
                    await biPlanner.findPath(sp.from, sp.to);
                    await fsPromise.appendFile(output, JSON.stringify(sp) + "\n", "utf-8");
                } else {
                    j--;
                }
            } catch (err) {
                j--;
                console.log(randomNode);
                console.error(err);
            }
        }
    }
}

/**
 * 
 * TODO: Remove hardcoded dependency on SPARQL-based index
 */
function loadIndex() {
    return new Promise(async (resolve, reject) => {
        const index = new Map();
        const file = await fsPromise.readFile(path.resolve("./era-index.json.gz"));
        gunzip(file, (err, buffer) => {
            if(err) reject(err);
            const rawIndex = JSON.parse(buffer.toString("utf8"));
            rawIndex.results.bindings.forEach(res => {
                index.set(res.id.value, {
                    id: res.id.value,
                    label: res.label.value,
                    wkt: res.wkt.value
                });
            });

            resolve(index);
        });
    });
}

function getRandomKey(collection) {
    let index = Math.floor(Math.random() * collection.size);
    let cntr = 0;
    for (let key of collection.keys()) {
        if (cntr++ === index) {
            return key;
        }
    }
}

run(); 