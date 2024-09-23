import { View, Text } from "react-native";
import { LatLng, Marker } from "react-native-maps";

export default function CustomMarker({coordinate}: {coordinate: LatLng}) {
  return (
    <Marker coordinate={coordinate}>
      <View>
        <Text>T</Text>
      </View>
    </Marker>
  )
}