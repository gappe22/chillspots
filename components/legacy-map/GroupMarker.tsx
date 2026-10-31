import { View, Text, Image } from "react-native";
import { LatLng, Marker } from "react-native-maps";

export default function GroupMarker({coordinate, size, members}: {
    coordinate: LatLng,
    size: number,
    members: number
}) {
  return (
    <Marker coordinate={coordinate}>
      <View style={{
        backgroundColor: "red"
      }}>
        <Image
          source={require('../../assets/images/IMG_1249.jpeg')}
          style={{
            width: size,
            height: size,

            borderRadius: size,
            borderWidth: size / 11.2,
            borderColor: "#f9f9ff",
          }}
        />
      </View>
    </Marker>
  )
}