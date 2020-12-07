import json

def processItem(item):
    return {
        "origin": {"type": "Point", "coordinates": item["origin"]},
        "destination": {"type": "Point", "coordinates": item["destination"]},
    }

with open("car-pullers.json") as f:

    d = json.load(f)
    dd = [processItem(item) for item in d["data"]]
    for item in dd:
        print (json.dumps(item))
