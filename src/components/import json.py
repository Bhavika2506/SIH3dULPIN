import json
import math

def align_and_unwarp_building(input_file, output_file):
    with open(input_file, 'r') as f:
        data = json.load(f)

    # 1. Original skewed anchors from the file
    nw = [73.8316069, 18.4412716]
    ne = [73.832277, 18.4412063]
    sw = [73.8315831, 18.4410756]

    # 2. Calculate exact building dimensions for the new orthogonal grid
    width = ((ne[0] - nw[0])**2 + (ne[1] - nw[1])**2) ** 0.5
    height = ((sw[0] - nw[0])**2 + (sw[1] - nw[1])**2) ** 0.5

    # 3. Define new perfect horizontal anchors based purely on distance
    new_nw = [nw[0], nw[1]]
    new_ne = [nw[0] + width, nw[1]]
    new_sw = [nw[0], nw[1] - height]
    new_se = [nw[0] + width, nw[1] - height]

    # 4. Un-warp function using dot-product projection
    def unwarp_point(px, py):
        # Find horizontal (u) and vertical (v) fractions across the skewed quad
        u = ((px - nw[0]) * (ne[0] - nw[0]) + (py - nw[1]) * (ne[1] - nw[1])) / (width ** 2)
        v = ((px - nw[0]) * (sw[0] - nw[0]) + (py - nw[1]) * (sw[1] - nw[1])) / (height ** 2)
        
        # Map onto the perfect rectangle and round to 8 decimals to snap walls together
        new_x = round(new_nw[0] + (u * width), 8)
        new_y = round(new_nw[1] - (v * height), 8)
        return [new_x, new_y]

    # 5. Apply Cartesian un-warping to every polygon
    for feature in data['features']:
        if feature['geometry']['type'] == 'Polygon':
            new_poly = []
            for ring in feature['geometry']['coordinates']:
                new_poly.append([unwarp_point(pt[0], pt[1]) for pt in ring])
            feature['geometry']['coordinates'] = new_poly

    # 6. Update georeference and bounding box
    data['georeference']['anchorCoordinates'] = [new_nw, new_ne, new_se, new_sw]
    data['georeference']['status'] = "orthogonally anchored"
    
    all_x = []
    all_y = []
    for feature in data['features']:
        for ring in feature['geometry']['coordinates']:
            for pt in ring:
                all_x.append(pt[0])
                all_y.append(pt[1])
                
    data['bbox'] = [min(all_x), min(all_y), max(all_x), max(all_y), data['bbox'][4], data['bbox'][5]]

    with open(output_file, 'w') as f:
        json.dump(data, f, indent=2)

print("Orthogonalizing geometry...")
align_and_unwarp_building(
    'C:/Users/Atharva/Desktop/3d-ulpin/JSPM_NTC_Narhe_C_Block_GeoJSON_anchored.geojson', 
    'C:/Users/Atharva/Desktop/3d-ulpin/JSPM_NTC_Narhe_C_Block_Perfect_Grid.geojson'
)
print("Complete. All units are now perfectly snapped to a horizontal/vertical grid.")