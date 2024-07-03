import React, { forwardRef, useEffect, useRef, useState } from "react";
import {
	NativeModules,
	PanResponder,
	Dimensions,
	Image,
	View,
	Animated,
	PanResponderInstance,
} from "react-native";
import Svg, { Polygon, PolygonProps } from "react-native-svg";
import Magnifier from "./Magnifier"; // Import the Magnifier component

const { width: screenWidth, height: screenHeight } = Dimensions.get("window");

const AnimatedPolygon = Animated.createAnimatedComponent(Polygon);

interface Coordinates {
	x: number;
	y: number;
}

interface Corners {
	topLeft: Animated.ValueXY;
	topRight: Animated.ValueXY;
	bottomRight: Animated.ValueXY;
	bottomLeft: Animated.ValueXY;
}

interface CustomCropProps {
	path: string;
	width: number;
	height: number;
	overlayColor?: string;
	overlayOpacity?: number;
	overlayStrokeColor?: string;
	handlerColor?: string;
	rectangleCoordinates?: {
		topLeft: Coordinates;
		topRight: Coordinates;
		bottomRight: Coordinates;
		bottomLeft: Coordinates;
	};
	updateImage: (path: string, coordinates: any) => void;
}

const CustomCrop = forwardRef((props: CustomCropProps, forwardedRef) => {
	const [viewHeight, setViewHeight] = useState(
		Dimensions.get("window").width * (props.height / props.width)
	);
	const [height, setHeight] = useState(props.height);
	const [width, setWidth] = useState(props.width);
	const [moving, setMoving] = useState(false);
	const [corners, setCorners] = useState<Corners>({
		topLeft: getInitialCoordinateValue({
			corner: "topLeft",
			props,
			viewHeight,
			height,
			width,
		}),
		topRight: getInitialCoordinateValue({
			corner: "topRight",
			props,
			viewHeight,
			height,
			width,
		}),
		bottomRight: getInitialCoordinateValue({
			corner: "bottomRight",
			props,
			viewHeight,
			height,
			width,
		}),
		bottomLeft: getInitialCoordinateValue({
			corner: "bottomLeft",
			props,
			viewHeight,
			height,
			width,
		}),
	});
	const [overlayPositions, setOverlayPositions] = useState(
		getOverlayPositions({
			topLeft: corners.topLeft,
			topRight: corners.topRight,
			bottomRight: corners.bottomRight,
			bottomLeft: corners.bottomLeft,
		})
	);

	const [magnifierPosition, setMagnifierPosition] =
		useState<Coordinates | null>(null); // Add state for magnifier position

	const panResponderTopLeft = useRef<PanResponderInstance | null>(null);
	const panResponderTopRight = useRef<PanResponderInstance | null>(null);
	const panResponderBottomLeft = useRef<PanResponderInstance | null>(null);
	const panResponderBottomRight = useRef<PanResponderInstance | null>(null);
	const polygonRef = useRef<Polygon>(null);

	useEffect(() => {
		NativeModules.CustomCropManager.findDocument(
			`file://${props.path}`,
			(error: any, coordinates: any) => {
				if (error) {
					console.warn(error);
					return;
				}

				if (coordinates) {
					let { topLeft, topRight, bottomLeft, bottomRight } = coordinates;

					let adjustment = 20;
					let viewTopLeft = imageCoordinatesToViewCoordinates({
						corner: { x: topLeft.x + adjustment, y: topLeft.y + adjustment },
						viewHeight,
						height,
						width,
					});
					let viewTopRight = imageCoordinatesToViewCoordinates({
						corner: { x: topRight.x - adjustment, y: topRight.y + adjustment },
						viewHeight,
						height,
						width,
					});
					let viewBottomLeft = imageCoordinatesToViewCoordinates({
						corner: {
							x: bottomLeft.x + adjustment,
							y: bottomLeft.y - adjustment,
						},
						viewHeight,
						height,
						width,
					});
					let viewBottomRight = imageCoordinatesToViewCoordinates({
						corner: {
							x: bottomRight.x - adjustment,
							y: bottomRight.y - adjustment,
						},
						viewHeight,
						height,
						width,
					});

					let animatedTopLeft = new Animated.ValueXY(viewTopLeft);
					let animatedTopRight = new Animated.ValueXY(viewTopRight);
					let animatedBottomLeft = new Animated.ValueXY(viewBottomLeft);
					let animatedBottomRight = new Animated.ValueXY(viewBottomRight);

					setCorners({
						topLeft: animatedTopLeft,
						topRight: animatedTopRight,
						bottomRight: animatedBottomRight,
						bottomLeft: animatedBottomLeft,
					});

					setOverlayPositions(
						getOverlayPositions({
							topLeft: animatedTopLeft,
							topRight: animatedTopRight,
							bottomRight: animatedBottomRight,
							bottomLeft: animatedBottomLeft,
						})
					);
				}
			}
		);
	}, [props.path, viewHeight, height, width]);

	useEffect(() => {
		panResponderTopLeft.current = createPanResponser({
			corner: corners.topLeft,
			state: { viewHeight },
			setMagnifierPosition,
			setOverlayPositions,
			getAnimatedXyNumbers,
			updateOverlayString,
		});
		panResponderTopRight.current = createPanResponser({
			corner: corners.topRight,
			state: { viewHeight },
			setMagnifierPosition,
			setOverlayPositions,
			getAnimatedXyNumbers,
			updateOverlayString,
		});
		panResponderBottomLeft.current = createPanResponser({
			corner: corners.bottomLeft,
			state: { viewHeight },
			setMagnifierPosition,
			setOverlayPositions,
			getAnimatedXyNumbers,
			updateOverlayString,
		});
		panResponderBottomRight.current = createPanResponser({
			corner: corners.bottomRight,
			state: { viewHeight },
			setMagnifierPosition,
			setOverlayPositions,
			getAnimatedXyNumbers,
			updateOverlayString,
		});
	}, [corners, viewHeight]);

	if (forwardedRef) {
		let refInstance = {
			crop: () =>
				crop({
					props,
					state: { viewHeight, corners, height, width },
					viewCoordinatesToImageCoordinates,
				}),
		};

		if (typeof forwardedRef === "function") {
			forwardedRef(refInstance);
		} else {
			forwardedRef.current = refInstance;
		}
	}

	useEffect(() => {
		const createListener =
			({ xIndex, yIndex }: { xIndex: number; yIndex: number }) =>
			({ x, y }: { x: number; y: number }) => {
				let points = (polygonRef.current?.props as PolygonProps)
					.points as number[];

				points[xIndex] = x;
				points[yIndex] = y;

				polygonRef.current?.setNativeProps({ points });
			};

		let listenerTopLeftId = corners.topLeft.addListener(
			createListener({ xIndex: 0, yIndex: 1 })
		);
		let listenerTopRightId = corners.topRight.addListener(
			createListener({ xIndex: 2, yIndex: 3 })
		);
		let listenerBottomRightId = corners.bottomRight.addListener(
			createListener({ xIndex: 4, yIndex: 5 })
		);
		let listenerBottomLeftId = corners.bottomLeft.addListener(
			createListener({ xIndex: 6, yIndex: 7 })
		);

		return () => {
			corners.topLeft.removeListener(listenerTopLeftId);
			corners.topRight.removeListener(listenerTopRightId);
			corners.bottomRight.removeListener(listenerBottomRightId);
			corners.bottomLeft.removeListener(listenerBottomLeftId);
		};
	}, [corners]);

	return (
		<View
			style={{
				flex: 1,
				alignItems: "center",
			}}
		>
			<View style={[s(props).cropContainer, { height: viewHeight }]}>
				<Image
					style={{ height: viewHeight }}
					resizeMode="contain"
					source={{ uri: `file://${props.path}` }}
					onLoad={(event) => {
						let {
							nativeEvent: {
								source: { width: imageWidth, height: imageHeight },
							},
						} = event;
						let viewHeight =
							(Dimensions.get("window").width * imageHeight) / imageWidth;

						setViewHeight(viewHeight);
						setHeight(imageHeight);
						setWidth(imageWidth);
					}}
				/>
				<Svg
					height={viewHeight}
					width={Dimensions.get("window").width}
					style={{ position: "absolute", left: 0, top: 0 }}
				>
					<AnimatedPolygon
						ref={polygonRef}
						fill={props.overlayColor || "blue"}
						fillOpacity={props.overlayOpacity || 0.5}
						stroke={props.overlayStrokeColor || "blue"}
						points={overlayPositions.toString()}
						onLayout={() => {}}
					/>
				</Svg>

				<Animated.View
					style={[
						s(props).handler,
						{
							transform: corners.topLeft.getTranslateTransform(),
							left: 100,
							top: 100,
						},
					]}
					{...panResponderTopLeft.current?.panHandlers}
				>
					<View style={[s(props).handlerI]} />
					<View style={[s(props).handlerRound]} />
				</Animated.View>
				<Animated.View
					style={[
						s(props).handler,
						{
							transform: corners.topRight.getTranslateTransform(),
							left: Dimensions.get("window").width - 100,
							top: 100,
						},
					]}
					{...panResponderTopRight.current?.panHandlers}
				>
					<View style={[s(props).handlerI]} />
					<View style={[s(props).handlerRound]} />
				</Animated.View>
				<Animated.View
					style={[
						s(props).handler,
						{
							transform: corners.bottomLeft.getTranslateTransform(),
							left: 100,
							top: viewHeight - 100,
						},
					]}
					{...panResponderBottomLeft.current?.panHandlers}
				>
					<View style={[s(props).handlerI]} />
					<View style={[s(props).handlerRound]} />
				</Animated.View>
				<Animated.View
					style={[
						s(props).handler,
						{
							transform: corners.bottomRight.getTranslateTransform(),
							left: Dimensions.get("window").width - 100,
							top: viewHeight - 100,
						},
					]}
					{...panResponderBottomRight.current?.panHandlers}
				>
					<View style={[s(props).handlerI]} />
					<View style={[s(props).handlerRound]} />
				</Animated.View>
			</View>
			{magnifierPosition && (
				<Magnifier
					x={magnifierPosition.x}
					y={magnifierPosition.y}
					path={props.path}
					viewWidth={Dimensions.get("window").width}
					viewHeight={viewHeight}
					imageWidth={width}
					imageHeight={height}
				/>
			)}
		</View>
	);
});

const createPanResponser = ({
	corner,
	state,
	setMagnifierPosition,
	setOverlayPositions,
	getAnimatedXyNumbers,
	updateOverlayString,
}: {
	corner: Animated.ValueXY;
	state: { viewHeight: number };
	setMagnifierPosition: React.Dispatch<
		React.SetStateAction<Coordinates | null>
	>;
	setOverlayPositions: React.Dispatch<React.SetStateAction<number[]>>;
	getAnimatedXyNumbers: (value: Animated.ValueXY) => { x: number; y: number };
	updateOverlayString: ({ state }: { state: any }) => void;
}) => {
	return PanResponder.create({
		onStartShouldSetPanResponder: () => true,
		onPanResponderMove: (e, gestureState) => {
			const { dx, dy } = gestureState;
			const { x, y } = getAnimatedXyNumbers(corner);
			const newX = Math.max(0, Math.min(screenWidth, x + dx));
			const newY = Math.max(0, Math.min(state.viewHeight, y + dy));
			corner.setValue({ x: newX, y: newY });
			updateOverlayString({ state });

			// Update magnifier position
			setMagnifierPosition({ x: newX, y: newY });
		},
		onPanResponderRelease: () => {
			corner.flattenOffset();
			updateOverlayString({ state });

			// Hide magnifier
			setMagnifierPosition(null);
		},
		onPanResponderGrant: () => {
			corner.setOffset(getAnimatedXyNumbers(corner));
			corner.setValue({ x: 0, y: 0 });

			// Show magnifier
			const { x, y } = getAnimatedXyNumbers(corner);
			setMagnifierPosition({ x, y });
		},
	});
};

const crop = ({
	props,
	state,
	viewCoordinatesToImageCoordinates,
}: {
	props: CustomCropProps;
	state: {
		viewHeight: number;
		corners: Corners;
		height: number;
		width: number;
	};
	viewCoordinatesToImageCoordinates: ({
		corner,
		state,
	}: {
		corner: Coordinates;
		state: any;
	}) => Coordinates;
}) => {
	const coordinates = {
		topLeft: viewCoordinatesToImageCoordinates({
			corner: getAnimatedXyNumbers(state.corners.topLeft),
			state,
		}),
		topRight: viewCoordinatesToImageCoordinates({
			corner: getAnimatedXyNumbers(state.corners.topRight),
			state,
		}),
		bottomLeft: viewCoordinatesToImageCoordinates({
			corner: getAnimatedXyNumbers(state.corners.bottomLeft),
			state,
		}),
		bottomRight: viewCoordinatesToImageCoordinates({
			corner: getAnimatedXyNumbers(state.corners.bottomRight),
			state,
		}),
	};

	NativeModules.CustomCropManager.crop(
		coordinates,
		`file://${props.path}`,
		(error: any, res: any) => {
			if (error) {
				console.warn(error);
				return;
			}

			props.updateImage(res.path, coordinates);
		}
	);
};

const getAnimatedNumber = (value: Animated.Value) => {
	return value.__getValue();
};

const getAnimatedXyNumbers = (value: Animated.ValueXY) => {
	return { x: getAnimatedNumber(value.x), y: getAnimatedNumber(value.y) };
};

const getInitialCoordinateValue = ({
	corner,
	props,
	viewHeight,
	height,
	width,
}: {
	corner: "topLeft" | "topRight" | "bottomLeft" | "bottomRight";
	props: CustomCropProps;
	viewHeight: number;
	height: number;
	width: number;
}) => {
	const defaultValues: { [key in typeof corner]: Coordinates } = {
		topLeft: { x: 100, y: 100 },
		topRight: { x: Dimensions.get("window").width - 100, y: 100 },
		bottomLeft: { x: 100, y: viewHeight - 100 },
		bottomRight: {
			x: Dimensions.get("window").width - 100,
			y: viewHeight - 100,
		},
	};

	const value = props.rectangleCoordinates
		? imageCoordinatesToViewCoordinates({
				corner: props.rectangleCoordinates[corner],
				viewHeight,
				height,
				width,
		  })
		: defaultValues[corner];

	return new Animated.ValueXY(value);
};

const getOverlayPositions = ({
	topLeft,
	topRight,
	bottomRight,
	bottomLeft,
}: {
	topLeft: Animated.ValueXY;
	topRight: Animated.ValueXY;
	bottomRight: Animated.ValueXY;
	bottomLeft: Animated.ValueXY;
}) => {
	return [
		getAnimatedNumber(topLeft.x),
		getAnimatedNumber(topLeft.y),
		getAnimatedNumber(topRight.x),
		getAnimatedNumber(topRight.y),
		getAnimatedNumber(bottomRight.x),
		getAnimatedNumber(bottomRight.y),
		getAnimatedNumber(bottomLeft.x),
		getAnimatedNumber(bottomLeft.y),
	];
};

const imageCoordinatesToViewCoordinates = ({
	corner,
	viewHeight,
	height,
	width,
}: {
	corner: Coordinates;
	viewHeight: number;
	height: number;
	width: number;
}) => {
	return {
		x: (corner.x * Dimensions.get("window").width) / width,
		y: (corner.y * viewHeight) / height,
	};
};

const updateOverlayString = ({ state }: { state: any }) => {
	const overlayPositions = getOverlayPositions({
		topLeft: state.corners.topLeft,
		topRight: state.corners.topRight,
		bottomRight: state.corners.bottomRight,
		bottomLeft: state.corners.bottomLeft,
	});

	state.setOverlayPositions(overlayPositions);
};

const viewCoordinatesToImageCoordinates = ({
	corner,
	state,
}: {
	corner: Coordinates;
	state: { viewHeight: number; height: number; width: number };
}) => {
	return {
		x: (corner.x / Dimensions.get("window").width) * state.width,
		y: (corner.y / state.viewHeight) * state.height,
	};
};

const s = (props: CustomCropProps) => ({
	handlerI: {
		borderRadius: 0,
		height: 20,
		width: 20,
		backgroundColor: props.handlerColor || "blue",
	},
	handlerRound: {
		width: 39,
		position: "absolute",
		height: 39,
		borderRadius: 100,
		backgroundColor: props.handlerColor || "blue",
	},
	image: {
		width: Dimensions.get("window").width,
	},
	cropContainer: {
		backgroundColor: "black",
	},
	handler: {
		position: "absolute",
		justifyContent: "center",
		alignItems: "center",
		width: 100,
		height: 100,
	},
});

export default CustomCrop;
