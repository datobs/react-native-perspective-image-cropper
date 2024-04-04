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
import type {
	Coordinates,
	CreatePanResponserArgs,
	CropArgs,
	CropResult,
	GetInitialCoordinateValueArgs,
	GetOverlayPositionsArgs,
	ImageCoordinatesToViewCoordinatesArgs,
	Props,
	Ref,
	State,
	UpdateOverlayStringArgs,
	Vars,
	ViewCoordinatesToImageCoordinatesArgs,
} from "./types";

const AnimatedPolygon = Animated.createAnimatedComponent(Polygon);

const CustomCrop = forwardRef<Ref, Props>((props, forwarededRef) => {
	const state = {} as State;
	const vars = {} as Vars;

	[state.viewHeight, state.setViewHeight] = useState(
		Dimensions.get("window").width * (props.height / props.width)
	);
	[state.height, state.setHeight] = useState(props.height);
	[state.width, state.setWidth] = useState(props.width);
	[state.moving, state.setMoving] = useState(false as boolean);
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

	vars.panResponderTopLeft = useRef(
		createPanResponser({ corner: state.corners.topLeft, state })
	);
	vars.panResponderTopRight = useRef(
		createPanResponser({ corner: state.corners.topRight, state })
	);
	vars.panResponderBottomLeft = useRef(
		createPanResponser({ corner: state.corners.bottomLeft, state })
	);
	vars.panResponderBottomRight = useRef(
		createPanResponser({ corner: state.corners.bottomRight, state })
	);
	vars.polygonRef = useRef(null);

	useEffect(() => {
		NativeModules.CustomCropManager.findDocument(
			`file://${props.path}`,
			(error: Error, coordinates: Coordinates) => {
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
		});
		vars.panResponderTopRight.current = createPanResponser({
			corner: state.corners.topRight,
			state,
		});
		vars.panResponderBottomLeft.current = createPanResponser({
			corner: state.corners.bottomLeft,
			state,
		});
		vars.panResponderBottomRight.current = createPanResponser({
			corner: state.corners.bottomRight,
			state,
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
			({ xIndex, yIndex }: { xIndex: number; yIndex: number }) =>
			({ x, y }: { x: number; y: number }) => {
				let points = (vars.polygonRef.current?.props as PolygonProps)
					.points as number[];

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
						strokeWidth={props.overlayStrokeWidth || 3}
					/>
				</Svg>

				<Animated.View
					{...vars.panResponderTopLeft.current.panHandlers}
					style={[state.corners.topLeft.getLayout(), s(props).handler]}
				>
					<View style={[s(props).handlerI, { left: -10, top: -10 }]} />
					<View style={[s(props).handlerRound, { left: 31, top: 31 }]} />
				</Animated.View>
				<Animated.View
					{...vars.panResponderTopRight.current.panHandlers}
					style={[state.corners.topRight.getLayout(), s(props).handler]}
				>
					<View style={[s(props).handlerI, { left: 10, top: -10 }]} />
					<View style={[s(props).handlerRound, { right: 31, top: 31 }]} />
				</Animated.View>
				<Animated.View
					{...vars.panResponderBottomLeft.current.panHandlers}
					style={[state.corners.bottomLeft.getLayout(), s(props).handler]}
				>
					<View style={[s(props).handlerI, { left: -10, top: 10 }]} />
					<View style={[s(props).handlerRound, { left: 31, bottom: 31 }]} />
				</Animated.View>
				<Animated.View
					{...vars.panResponderBottomRight.current.panHandlers}
					style={[state.corners.bottomRight.getLayout(), s(props).handler]}
				>
					<View style={[s(props).handlerI, { left: 10, top: 10 }]} />
					<View style={[s(props).handlerRound, { right: 31, bottom: 31 }]} />
				</Animated.View>
			</View>
		</View>
	);
});

const createPanResponser = ({ corner, state }: CreatePanResponserArgs) => {
	return PanResponder.create({
		onStartShouldSetPanResponder: () => true,
		onPanResponderMove: Animated.event([null, { dx: corner.x, dy: corner.y }], {
			useNativeDriver: false,
		}),
		onPanResponderRelease: () => {
			corner.flattenOffset();
			updateOverlayString({ state });
		},
		onPanResponderGrant: () => {
			corner.setOffset(getAnimatedXyNumbers(corner));
			corner.setValue({ x: 0, y: 0 });
		},
	});
};

const crop = ({ props, state }: CropArgs) => {
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
		(error: Error | null, res: CropResult) => {
			if (error) {
				console.warn(error);
				return;
			}

			props.updateImage(res.path, coordinates);
		}
	);
};

const getAnimatedNumber = (value: Animated.Value) => {
	return (value as any)._value as number;
};

const getAnimatedXyNumbers = (value: Animated.ValueXY) => {
	return { x: getAnimatedNumber(value.x), y: getAnimatedNumber(value.y) };
};

const getInitialCoordinateValue = ({
	corner,
	props,
	state,
}: GetInitialCoordinateValueArgs) => {
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
}: GetOverlayPositionsArgs) => {
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
	state,
}: ImageCoordinatesToViewCoordinatesArgs) => {
	return {
		x: (corner.x * Dimensions.get("window").width) / state.width,
		y: (corner.y * state.viewHeight) / state.height,
	};
};

const updateOverlayString = ({ state }: UpdateOverlayStringArgs) => {
	let overlayPositions = getOverlayPositions({
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
}: ViewCoordinatesToImageCoordinatesArgs) => {
	return {
		x: (corner.x / Dimensions.get("window").width) * state.width,
		y: (corner.y / state.viewHeight) * state.height,
	};
};

const s = (props: Props) =>
	({
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
			// position: 'absolute',
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
	} as const);

export { CustomCrop };
