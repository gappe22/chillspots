import { useEffect, useRef, useState } from "react";
import MapView, { BoundingBox, LatLng, Marker, Region } from "react-native-maps"
import CustomMarker from "./CustomMarker";
import GroupMarker from "./GroupMarker";

export interface Point {
  id: number,
  coords: LatLng
}

export interface Spot extends Point {
  groupId?: number 
}

export interface Group extends Point {
  members: number
}

export default function Map({spots, groups, initialRegion, onRegionChange}: {
  spots: Spot[],
  groups: Group[],
  initialRegion: Region,
  onRegionChange: (region: Region) => void
}) {
  return (
    <MapView
      //ref={map}
      initialRegion={initialRegion}
      onRegionChange={onRegionChange}
      style={{width: "100%", height: "100%"}}
      showsPointsOfInterest={false}
    >
      {spots.filter(v => v.groupId == undefined).map(spot => (
        <CustomMarker
          key={spot.id}
          coordinate={spot.coords}
          size={45}
        />
      ))}
      
      {groups.map(group => (
        <GroupMarker
          key={group.id}
          coordinate={group.coords}
          size={45}
          members={group.members}
        />
      ))}
    </MapView>
  );
}