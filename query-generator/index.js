import { Command } from "commander";
import fsPromise from "fs/promises";
import path from "path";
import { parse as wktParse } from 'wellknown';
import { Dijkstra } from "tiles-planner";

async function run() {
    const program = new Command()
        .requiredOption("--tiles <tiles>", "Tile interface URL")
        .requiredOption("-i, --index <index>", "Path to local location index")
        .requiredOption("-o, --output <output>", "File path where the output will be stored")
        .option("--max-rank <maxRank>", "Maximum k for Dijkstra ranks DR=2^k (default: k=20)", 20)
        .option("--query-amount <queryAmount>", "Number of queries per rank (default: 10)", 10)
        .parse(process.argv);

    const output = path.resolve(program.opts().output);
    const maxRank = parseInt(program.opts().maxRank);
    const queryAmount = parseInt(program.opts().queryAmount);
    const index = new Map(JSON.parse(await fsPromise.readFile(program.opts().index)));
    const planner = new Dijkstra({
        tilesBaseURL: program.opts().tiles,
        zoom: 12,
        distance: (node) => { return node.cost }
    });

    // Generate random queries for Dijkstra ranks given by 
    for (let i = 5; i < maxRank; i++) {
        const DijkstraRank = Math.pow(2, i);
        console.log("Dijkstra Rank: ", DijkstraRank);

        for (let j = 0; j < queryAmount; j++) {
            const randomNode = index.get(getRandomKey(index));
            randomNode.coordinates = wktParse(randomNode.wkt).coordinates;
            try {
                const sp = await planner.findPath(randomNode, undefined, DijkstraRank);
                if (sp) {
                    // clean up path
                    sp.path.forEach(n => {
                        delete n.nextNodes;
                        delete n.prevNodes;
                    });
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