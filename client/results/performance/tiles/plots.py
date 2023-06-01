import gzip
import json
import numpy as np
from matplotlib import pyplot as plt

# Function to calculate Y-axis (average response time) values
def get_response_times(z, server, cache):
    if(cache == True):
        root_path = "./" + server + "/tiles_" + server + "_zoom-" + str(z) + "_no-client-cache_server-cache.json.gz"
    else:
        root_path = "./" + server + "/tiles_" + server + "_zoom-" + str(z) + "_no-client-cache_no-server-cache.json.gz"
    
    # Opening gzipped JSON file
    with gzip.open(root_path, 'rt') as fin:
        data = json.load(fin)
        x = []
        y = []
        dijkstra_ranks = data['globals']['dijkstraRanks']
        for key, value in dijkstra_ranks.items():
            if(value['avgResTime'] > 0):
                x.append(key)
                y.append(value['avgResTime'])
        
        return x, y, data['globals']['totalTimeouts']

fig, ((ax1, ax2)) = plt.subplots(1, 2)
lw = 2
x_axis = [2**5, 2**6, 2**7, 2**8, 2**9, 2**10, 2**11, 2**12, 2**13, 2**14, 2**15, 2**16, 2**17]

# Plot results with server cache
for z in range(6, 16):
    x, y, timeouts = get_response_times(z, 'virtuoso', True)
    ax1.plot(x, y, marker='o', markersize=3.5, label="Z=" + str(z) + " (timeouts= "+ str(timeouts) +")", linewidth=lw)

ax1.set_title("Tiles server (with cache)")
ax1.legend(loc="upper center", ncol=2)
ax1.set_xlabel("Dijkstra rank")
ax1.set_ylabel("average query response time (ms)")
ax1.grid(alpha=0.3)
ax1.set_xticklabels( [f"2^{j:.0f}" for j in np.log2(x_axis)])

for z in range(6, 16):
    x, y, timeouts = get_response_times(z, 'virtuoso', False)
    ax2.plot(x, y, marker='o', markersize=3.5, label="Z=" + str(z) + " (timeouts= "+ str(timeouts) +")", linewidth=lw)

ax2.set_title("Tiles server (without cache)")
ax2.legend(loc="upper center", ncol=2)
ax2.set_xlabel("Dijkstra rank")
ax2.set_ylabel("average query response time (ms)")
ax2.grid(alpha=0.3)
ax2.set_xticklabels( [f"2^{j:.0f}" for j in np.log2(x_axis)])

plt.show()