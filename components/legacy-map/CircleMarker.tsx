import { Circle, LatLng } from "react-native-maps";

export default function CircleMarker({coordinate}: {coordinate: LatLng}) {
  return (
    <Circle
      center={coordinate}
      radius={20}
    />
  )
}