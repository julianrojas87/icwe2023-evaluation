import { Command } from "commander";
import fsPromise from "fs/promises";
import path from "path";
import { QueryEngine } from "@comunica/query-sparql";
import { parse as wktParse } from 'wellknown';
import { Dijkstra, NBAStar, Utils } from "tiles-planner";

async function run() {
    const program = new Command()
        .requiredOption("--tiles <tiles>", "Tile interface URL")
        .requiredOption("--graph-store <graphStore>", "Graph store address (only SPARQL supported so far)")
        .requiredOption("-o, --output <output>", "File path where the output will be stored")
        .option("--min-rank <minRank>", "Minimum k for Dijkstra ranks DR=2^k (default: k=5)", 5)
        .option("--max-rank <maxRank>", "Maximum k for Dijkstra ranks DR=2^k (default: k=20)", 19)
        .option("--query-amount <queryAmount>", "Number of queries per rank (default: 10)", 10)
        .option("--country <country>", "Generate random queries for a specific country (e.g., BEL, FRA, ESP, etc)")
        .parse(process.argv);

    const output = path.resolve(program.opts().output);
    const minRank = parseInt(program.opts().minRank);
    const maxRank = parseInt(program.opts().maxRank);
    const queryAmount = parseInt(program.opts().queryAmount);
    
    // Create index of graph nodes from graph store
    const index = await loadIndex(program.opts().graphStore, program.opts().country);

    // Use a Dijkstra planner 
    const planner = new Dijkstra({
        tilesBaseURL: program.opts().tiles,
        zoom: 9,
        distance: (node) => { return node.cost }
    });

    // Have a NBA* planner for verification
    const biPlanner = new NBAStar({
        tilesBaseURL: program.opts().tiles,
        zoom: 9,
        distance: (node) => { return node.cost },
        heuristic: Utils.harvesineDistance
    });

    // Generate random queries for Dijkstra ranks given by 
    for (let i = minRank; i < maxRank; i++) {
        const DijkstraRank = Math.pow(2, i);

        for (let j = 0; j < queryAmount; j++) {
            const randomNode = index.get(getRandomKey(index));
            randomNode.coordinates = wktParse(randomNode.wkt).coordinates;

            try {
                console.log(`Finding route number ${j} for Dijkstra Rank ${DijkstraRank} from ${randomNode.label}...`)
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

async function loadIndex(graphStore, country) {
    const index = new Map();
    // Create node index by querying a graph store (only SPARQL for now)
    const comunica = new QueryEngine();
    const bindings = await (await comunica.queryBindings(`
        PREFIX era: <http://data.europa.eu/949/>
        PREFIX gsp: <http://www.opengis.net/ont/geosparql#>

        SELECT ?id ?label ?wkt WHERE {
            ?id a era:NetElement;
               ^era:elementPart [
                  era:hasImplementation [
                     era:opName ?label;
                     era:inCountry ${country ? 
                        `<http://publications.europa.eu/resource/authority/country/${country}>` : "?c"};
                     gsp:hasGeometry [ gsp:asWKT ?wkt ]
                  ]
               ]
        }`,
        { sources: [{ type: "sparql", value: graphStore }] }
    )).toArray();

    for(const binding of bindings) {
        index.set(binding.get("id").value, {
            id: binding.get("id").value,
            label: binding.get("label").value,
            wkt: binding.get("wkt").value
        });
    }

    return index;
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