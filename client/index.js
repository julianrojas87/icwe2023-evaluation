import { Command } from "commander";
import fs from "fs";
import path from "path";
import { fetch } from "undici";

async function run() {
    const program = new Command()
        .requiredOption("--test <test>", "Type of experiment (scalability, performance)")
        .requiredOption("--gs-type <gs>", "Graph Storage type to be tested (graphdb, virtuoso, osrm, stardog, neo4j)")
        .requiredOption("--gs-address <gsAdd>", "Graph Storage server address")
        .option("--tiles-interface", "HTTP URL of the Tiles Interface (if any)")
        .option("--clients <clients>", "Number of concurrent clients to execute", 1)
        .option("--iterations <iterations>", "Number of repetitions of the query set", 1)
        .option("--record", "Flag to trigger stats recording", true)
        .parse(process.argv);

    // Start by loading the query set
    const querySet = await loadQuerySet();

}

function loadQuerySet() {
    return new Promise((resolve, reject) => {
        fs.createReadStream(path.resolve("../random-queries_5-18.json.gz"))
    });
}

run();