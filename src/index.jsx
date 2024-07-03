import React, { forwardRef, useEffect, useRef, useState } from "react";
import {
	NativeModules,
	PanResponder,
	Dimensions,
	Image,
	View,
	Animated,
} from "react-native";
import Svg, { Polygon, PolygonProps } from "react-native-svg";
import Magnifier from "./Magnifier"; // Import the Magnifier component

const { width: screenWidth, height: screenHeight } = Dimensions.get("window");

const AnimatedPolygon = Animated.createAnimatedComponent(Polygon);

const CustomCrop = forwardRef((props, forwarededRef) => {
	const state = {};
	const vars = {};

	[state.viewHeight, state.setViewHeight] = useState(
		Dimensions.get("window").width * (props.height / props.width)
	);
	[state.height, state.setHeight] = useState(props.height);
	[state.width, state.setWidth] = useState(props.width);
	[state.moving, state.setMoving] = useState(false);
	[state.corners, state.setCorners] = useState({
		topLeft: getInitialCoordinateValue({ corner: "topLeft", props, state }),
		topRight: getInitialCoordinateValue({ corner: "topRight", props, state }),
		bottomRight: getInitialCoordinateValue({
			corner: "bottomRight",
			props,
			state,
		}),
		bottomLeft: getInitialCoordinateValue({
			corner: "bottomLeft",
			props,
			state,
		}),
	});
	[state.overlayPositions, state.setOverlayPositions] = useState(
		getOverlayPositions({
			topLeft: state.corners.topLeft,
			topRight: state.corners.topRight,
			bottomRight: state.corners.bottomRight,
			bottomLeft: state.corners.bottomLeft,
		})
	);

	[state.magnifierPosition, state.setMagnifierPosition] = useState(null); // Add state for magnifier position

	vars.panResponderTopLeft = useRef(
		createPanResponser({
			corner: state.corners.topLeft,
			state,
			cornerName: "topLeft",
		})
	);
	vars.panResponderTopRight = useRef(
		createPanResponser({
			corner: state.corners.topRight,
			state,
			cornerName: "topRight",
		})
	);
	vars.panResponderBottomLeft = useRef(
		createPanResponser({
			corner: state.corners.bottomLeft,
			state,
			cornerName: "bottomLeft",
		})
	);
	vars.panResponderBottomRight = useRef(
		createPanResponser({
			corner: state.corners.bottomRight,
			state,
			cornerName: "bottomRight",
		})
	);
	vars.polygonRef = useRef(null);

	useEffect(() => {
		NativeModules.CustomCropManager.findDocument(
			`file://${props.path}`,
			(error, coordinates) => {
				if (error) {
					console.warn(error);
					return;
				}

				if (coordinates) {
					let { topLeft, topRight, bottomLeft, bottomRight } = coordinates;

					let adjustment = 20;
					let viewTopLeft = imageCoordinatesToViewCoordinates({
						corner: { x: topLeft.x + adjustment, y: topLeft.y + adjustment },
						state,
					});
					let viewTopRight = imageCoordinatesToViewCoordinates({
						corner: { x: topRight.x - adjustment, y: topRight.y + adjustment },
						state,
					});
					let viewBottomLeft = imageCoordinatesToViewCoordinates({
						corner: {
							x: bottomLeft.x + adjustment,
							y: bottomLeft.y - adjustment,
						},
						state,
					});
					let viewBottomRight = imageCoordinatesToViewCoordinates({
						corner: {
							x: bottomRight.x - adjustment,
							y: bottomRight.y - adjustment,
						},
						state,
					});

					let animatedTopLeft = new Animated.ValueXY(viewTopLeft);
					let animatedTopRight = new Animated.ValueXY(viewTopRight);
					let animatedBottomLeft = new Animated.ValueXY(viewBottomLeft);
					let animatedBottomRight = new Animated.ValueXY(viewBottomRight);

					state.setCorners({
						topLeft: animatedTopLeft,
						topRight: animatedTopRight,
						bottomRight: animatedBottomRight,
						bottomLeft: animatedBottomLeft,
					});

					state.setOverlayPositions(
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
	}, []);

	useEffect(() => {
		vars.panResponderTopLeft.current = createPanResponser({
			corner: state.corners.topLeft,
			state,
			cornerName: "topLeft",
		});
		vars.panResponderTopRight.current = createPanResponser({
			corner: state.corners.topRight,
			state,
			cornerName: "topRight",
		});
		vars.panResponderBottomLeft.current = createPanResponser({
			corner: state.corners.bottomLeft,
			state,
			cornerName: "bottomLeft",
		});
		vars.panResponderBottomRight.current = createPanResponser({
			corner: state.corners.bottomRight,
			state,
			cornerName: "bottomRight",
		});
	}, [state.corners]);

	if (forwarededRef) {
		let refInstance = {
			crop: () => crop({ props, state }),
		};

		if (typeof forwarededRef === "function") {
			forwarededRef(refInstance);
		} else {
			forwarededRef.current = refInstance;
		}
	}

	useEffect(() => {
		let createListener =
			({ xIndex, yIndex }) =>
			({ x, y }) => {
				points[xIndex] = x;
				points[yIndex] = y;

				vars.polygonRef.current?.setNativeProps({ points });
			};

		let listenerTopLeftId = state.corners.topLeft.addListener(
			createListener({ xIndex: 0, yIndex: 1 })
		);
		let listenerTopRightId = state.corners.topRight.addListener(
			createListener({ xIndex: 2, yIndex: 3 })
		);
		let listenerBottomRightId = state.corners.bottomRight.addListener(
			createListener({ xIndex: 4, yIndex: 5 })
		);
		let listenerBottomLeftId = state.corners.bottomLeft.addListener(
			createListener({ xIndex: 6, yIndex: 7 })
		);

		return () => {
			state.corners.topLeft.removeListener(listenerTopLeftId);
			state.corners.topRight.removeListener(listenerTopRightId);
			state.corners.bottomRight.removeListener(listenerBottomRightId);
			state.corners.bottomLeft.removeListener(listenerBottomLeftId);
		};
	}, [state.corners]);

	return (
		<View
			style={{
				flex: 1,
				alignItems: "center",
			}}
		>
			<View style={[s(props).cropContainer, { height: state.viewHeight }]}>
				<Image
					style={[s(props).image, { height: state.viewHeight }]}
					resizeMode="contain"
					source={{ uri: `file://${props.path}` }}
				/>

				<Svg
					height={state.viewHeight}
					width={Dimensions.get("window").width}
					style={{ position: "absolute", left: 0, top: 0 }}
				>
					<AnimatedPolygon
						fill={props.overlayColor || "blue"}
						fillOpacity={props.overlayOpacity || 0.5}
						stroke={props.overlayStrokeColor || "blue"}
						points={state.overlayPositions}
						ref={vars.polygonRef}
						onLayout={() => {}}
					/>
				</Svg>

				<Animated.View
					style={[
						s(props).handler,
						{
							transform: state.corners.topLeft.getTranslateTransform(),
							left: 100,
							top: 100,
						},
					]}
					{...vars.panResponderTopLeft.current.panHandlers}
				>
					<View style={[s(props).handlerI]} />
					<View style={[s(props).handlerRound]} />
				</Animated.View>
				<Animated.View
					style={[
						s(props).handler,
						{
							transform: state.corners.topRight.getTranslateTransform(),
							left: Dimensions.get("window").width - 100,
							top: 100,
						},
					]}
					{...vars.panResponderTopRight.current.panHandlers}
				>
					<View style={[s(props).handlerI]} />
					<View style={[s(props).handlerRound]} />
				</Animated.View>
				<Animated.View
					style={[
						s(props).handler,
						{
							transform: state.corners.bottomLeft.getTranslateTransform(),
							left: 100,
							top: state.viewHeight - 100,
						},
					]}
					{...vars.panResponderBottomLeft.current.panHandlers}
				>
					<View style={[s(props).handlerI]} />
					<View style={[s(props).handlerRound]} />
				</Animated.View>
				<Animated.View
					style={[
						s(props).handler,
						{
							transform: state.corners.bottomRight.getTranslateTransform(),
							left: Dimensions.get("window").width - 100,
							top: state.viewHeight - 100,
						},
					]}
					{...vars.panResponderBottomRight.current.panHandlers}
				>
					<View style={[s(props).handlerI]} />
					<View style={[s(props).handlerRound]} />
				</Animated.View>
			</View>
			{state.magnifierPosition && (
				<Magnifier
					x={state.magnifierPosition.x}
					y={state.magnifierPosition.y}
					path={props.path}
					viewWidth={Dimensions.get("window").width}
					viewHeight={state.viewHeight}
					imageWidth={state.width}
					imageHeight={state.height}
				/>
			)}
		</View>
	);
});

const createPanResponser = ({ corner, state, cornerName }) => {
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
			state.setMagnifierPosition({ x: newX, y: newY });
		},
		onPanResponderRelease: () => {
			corner.flattenOffset();
			updateOverlayString({ state });

			// Hide magnifier
			state.setMagnifierPosition(null);
		},
		onPanResponderGrant: () => {
			corner.setOffset(getAnimatedXyNumbers(corner));
			corner.setValue({ x: 0, y: 0 });

			// Show magnifier
			const { x, y } = getAnimatedXyNumbers(corner);
			state.setMagnifierPosition({ x, y });
		},
	});
};

const crop = ({ props, state }) => {
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
		(error, res) => {
			if (error) {
				console.warn(error);
				return;
			}

			props.updateImage(res.path, coordinates);
		}
	);
};

const getAnimatedNumber = (value) => {
	return value._value;
};

const getAnimatedXyNumbers = (value) => {
	return { x: getAnimatedNumber(value.x), y: getAnimatedNumber(value.y) };
};

const getInitialCoordinateValue = ({ corner, props, state }) => {
	let defaultValues = {
		topLeft: { x: 100, y: 100 },
		topRight: { x: Dimensions.get("window").width - 100, y: 100 },
		bottomLeft: { x: 100, y: state.viewHeight - 100 },
		bottomRight: {
			x: Dimensions.get("window").width - 100,
			y: state.viewHeight - 100,
		},
	};

	let value = props.rectangleCoordinates
		? imageCoordinatesToViewCoordinates({
				corner: props.rectangleCoordinates[corner],
				state,
		  })
		: defaultValues[corner];

	return new Animated.ValueXY(value);
};

const getOverlayPositions = ({
	topLeft,
	topRight,
	bottomRight,
	bottomLeft,
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

const imageCoordinatesToViewCoordinates = ({ corner, state }) => {
	return {
		x: (corner.x * Dimensions.get("window").width) / state.width,
		y: (corner.y * state.viewHeight) / state.height,
	};
};

const updateOverlayString = ({ state }) => {
	let overlayPositions = getOverlayPositions({
		topLeft: state.corners.topLeft,
		topRight: state.corners.topRight,
		bottomRight: state.corners.bottomRight,
		bottomLeft: state.corners.bottomLeft,
	});

	state.setOverlayPositions(overlayPositions);
};

const viewCoordinatesToImageCoordinates = ({ corner, state }) => {
	return {
		x: (corner.x / Dimensions.get("window").width) * state.width,
		y: (corner.y / state.viewHeight) * state.height,
	};
};

const s = (props) => ({
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
	bottomButton: {
		alignItems: "center",
		justifyContent: "center",
		backgroundColor: "blue",
		width: 70,
		height: 70,
		borderRadius: 100,
	},
	handler: {
		height: 140,
		width: 140,
		overflow: "visible",
		marginLeft: -70,
		marginTop: -70,
		alignItems: "center",
		justifyContent: "center",
		position: "absolute",
	},
	cropContainer: {
		position: "absolute",
		left: 0,
		width: Dimensions.get("window").width,
		top: 0,
	},
});

export { CustomCrop };
