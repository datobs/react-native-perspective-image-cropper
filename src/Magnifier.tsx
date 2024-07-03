import React from "react";
import { View, Image, StyleSheet } from "react-native";

interface MagnifierProps {
	x: number;
	y: number;
	path: string;
	viewWidth: number;
	viewHeight: number;
	imageWidth: number;
	imageHeight: number;
}

const Magnifier: React.FC<MagnifierProps> = ({
	x,
	y,
	path,
	viewWidth,
	viewHeight,
	imageWidth,
	imageHeight,
}) => {
	const magnifierSize = 100;
	const scale = 2;

	const left = Math.max(0, x - magnifierSize / (2 * scale));
	const top = Math.max(0, y - magnifierSize / (2 * scale));

	const styles = StyleSheet.create({
		magnifierContainer: {
			position: "absolute",
			left: x - magnifierSize / 2,
			top: y - magnifierSize / 2,
			width: magnifierSize,
			height: magnifierSize,
			borderRadius: magnifierSize / 2,
			overflow: "hidden",
			borderWidth: 2,
			borderColor: "blue",
			backgroundColor: "white",
		},
		magnifiedImage: {
			position: "absolute",
			width: viewWidth * scale,
			height: viewHeight * scale,
			left: -left * scale,
			top: -top * scale,
		},
	});

	return (
		<View style={styles.magnifierContainer}>
			<Image
				source={{ uri: `file://${path}` }}
				style={styles.magnifiedImage}
				resizeMode="contain"
			/>
		</View>
	);
};

export default Magnifier;
