import { Button, ImageURISource, Text, useWindowDimensions, View } from "react-native";
import MapView, { Region, Point, LatLng, Marker, Circle } from 'react-native-maps';
import { useSafeAreaInsets } from "react-native-safe-area-context";
import TextButton from "../components/TextButton";
import IconButton from "../components/IconButton";
import { useRef, useState } from "react";
import Map from "./Map";

export default function Index() {
  const [region, setRegion] = useState<Region>({latitude: 45.50104569101561, longitude: 10.498704840746742, latitudeDelta: 0.06, longitudeDelta: 0.06});
  const [pinPoints, setPinPoints] = useState([
    {id: 1, coords: {latitude: 45.50104569101561, longitude: 10.498704840746742}},
    // {id: 2, coords: {latitude: 45.49800760953692, longitude: 10.504884650414132}}
  ])
  
  const {width, height, scale} = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const pinIcon: ImageURISource = require("../assets/images/pinpoint.png");
  pinIcon.width = 100;
  pinIcon.height = 100;

  return (
    <View
      style={{
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <Map spots={pinPoints}></Map>
      
      <View style={{
        position: "absolute",
        top: 0,
        left: 10,

        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        flexDirection: "column",
        paddingTop: insets.top,
        paddingBottom: insets.bottom
      }}>
        
      </View>
    </View>
  );
}
