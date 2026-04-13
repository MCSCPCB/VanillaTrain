import { world } from "@minecraft/server";

import { minecartRegistry } from "./DataStorage.js";

const OVERWORLD_ID = "overworld";
const TRAIN_SURFACE_TYPES = new Set([
     "minecraft:minecart",
     "train:entity_block",
]);
const FOOT_SUPPORT_SAMPLE_OFFSETS = Object.freeze([
     { x: 0, z: 0 },
     { x: 0.25, z: 0 },
     { x: -0.25, z: 0 },
     { x: 0, z: 0.25 },
     { x: 0, z: -0.25 },
     { x: 0.25, z: 0.25 },
     { x: 0.25, z: -0.25 },
     { x: -0.25, z: 0.25 },
     { x: -0.25, z: -0.25 },
]);

export const HALF_BLOCK_EPSILON = 1e-5;

// 供建造、更新、绑定等模块复用的通用工具函数。
export function getOverworldDimension() {
     return world.getDimension(OVERWORLD_ID);
}

export function hasSolidBlockBelowFeet(
     entity,
     verticalEpsilon = 0.01
) {
     if (!entity?.isValid()) {
          return false;
     }

     const footY = Math.floor(entity.location.y - verticalEpsilon);

     return FOOT_SUPPORT_SAMPLE_OFFSETS.some((offset) => {
          const block = entity.dimension.getBlock({
               x: Math.floor(entity.location.x + offset.x),
               y: footY,
               z: Math.floor(entity.location.z + offset.z),
          });
          return !!block && block.typeId !== "minecraft:air";
     });
}

export function isHorizontalRailDirection(railDirection) {
     return railDirection === 0 || railDirection === 1;
}

export function isCurveRailDirection(railDirection) {
     return railDirection >= 6 && railDirection <= 9;
}

export function getRailDirectionAtLocation(
     location,
     dimension = getOverworldDimension()
) {
     return dimension.getBlock(location).permutation.getState("rail_direction");
}

export function isTrainSurfaceEntity(entity) {
     return entity ? TRAIN_SURFACE_TYPES.has(entity.typeId) : false;
}

export function findFirstTrainSurface(entities) {
     return entities.find((entity) => isTrainSurfaceEntity(entity));
}

export function findRegisteredMinecartTag(entity) {
     return entity?.getTags().find((tag) => minecartRegistry.has(tag));
}

export function isHalfBlockCoordinate(
     coordinate,
     epsilon = HALF_BLOCK_EPSILON
) {
     const fractionalPart = Math.abs(coordinate - Math.floor(coordinate) - 0.5);
     return fractionalPart < epsilon || fractionalPart > 1 - epsilon;
}

export function snapToHalfBlock(coordinate, epsilon = HALF_BLOCK_EPSILON) {
     if (isHalfBlockCoordinate(coordinate, epsilon)) {
          return coordinate;
     }

     return Math.round(coordinate - 0.5) + 0.5;
}

// 统一把矿车水平坐标对齐到半格中心，保证偏移计算使用稳定基准。
export function standardizeHorizontalEntityPosition(
     entity,
     epsilon = HALF_BLOCK_EPSILON
) {
     const currentLocation = entity.location;
     const targetLocation = {
          x: snapToHalfBlock(currentLocation.x, epsilon),
          y: currentLocation.y,
          z: snapToHalfBlock(currentLocation.z, epsilon),
     };

     const hasChanged =
          Math.abs(targetLocation.x - currentLocation.x) > epsilon ||
          Math.abs(targetLocation.z - currentLocation.z) > epsilon;

     if (hasChanged) {
          entity.teleport(targetLocation, {
               dimension: entity.dimension,
          });
          return targetLocation;
     }

     return currentLocation;
}
