import { View, Text, Image } from "react-native";
import { LatLng, Marker } from "react-native-maps";

export default function CustomMarker({coordinate, size}: {coordinate: LatLng, size: number}) {
  return (
    <Marker coordinate={coordinate}>
      <View style={{
        shadowColor: "black",
        shadowOpacity: 0.25,
        shadowOffset: {width: 0, height: 0},
        shadowRadius: 3.2
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
