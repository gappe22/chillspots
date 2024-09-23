import { useRef } from "react";
import MapView, { LatLng, Marker, UrlTile } from "react-native-maps"
import CustomMarker from "./CustomMarker";
import CircleMarker from "./CircleMarker";

interface Spot {
  id: number,
  coords: LatLng
}

export default function Map({spots}: {spots: Spot[]}) {
  const map = useRef<MapView>(null);

  return (
    <MapView
      ref={map}
      style={{width: "100%", height: "100%"}}
      showsPointsOfInterest={false}
    >
      {spots.map((spot) => (
        <CircleMarker
          key={spot.id}
          coordinate={spot.coords}
        />
      ))}
    </MapView>
  );
}