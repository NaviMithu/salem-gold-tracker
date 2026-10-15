import React, { useState, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  PanResponder,
  GestureResponderEvent,
  PanResponderGestureState,
} from 'react-native';
import Svg, {
  Path,
  Defs,
  LinearGradient,
  Stop,
  Circle,
  Line,
} from 'react-native-svg';
import { DayRate22K } from '../services/goldRateService';

interface GoldChartProps {
  history: DayRate22K[];
}

export const GoldChart: React.FC<GoldChartProps> = ({ history }) => {
  // If no history, show placeholder
  if (!history || history.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No historical price data available yet.</Text>
      </View>
    );
  }

  // Reverse history so oldest is on the left (e.g. Sep 16) and newest on the right (Oct 15)
  const chartData = useMemo(() => [...history].reverse(), [history]);

  const prices = useMemo(() => chartData.map((d) => d.rate22K), [chartData]);
  const minPrice = useMemo(() => Math.min(...prices), [prices]);
  const maxPrice = useMemo(() => Math.max(...prices), [prices]);
  const priceRange = maxPrice - minPrice || 100;

  // Selected index for interactive hover/touch (defaults to the latest day)
  const [selectedIndex, setSelectedIndex] = useState<number>(chartData.length - 1);

  // Layout sizing
  const screenWidth = Dimensions.get('window').width;
  const chartWidth = screenWidth - 72; // Accounting for card margins and inner padding
  const chartHeight = 210;
  const paddingH = 14;
  const paddingTop = 32;
  const paddingBottom = 22;

  const innerWidth = chartWidth - paddingH * 2;
  const innerHeight = chartHeight - paddingTop - paddingBottom;

  // Compute (x, y) coordinates for all points
  const points = useMemo(() => {
    return chartData.map((item, index) => {
      const x = paddingH + (index / (chartData.length - 1 || 1)) * innerWidth;
      const y =
        paddingTop +
        innerHeight -
        ((item.rate22K - minPrice) / priceRange) * innerHeight;

      return { x, y, price: item.rate22K, item, index };
    });
  }, [chartData, innerWidth, innerHeight, minPrice, priceRange, paddingH, paddingTop]);

  // Construct SVG line and area paths
  const { linePath, areaPath } = useMemo(() => {
    if (points.length === 0) return { linePath: '', areaPath: '' };

    const lPath = points.reduce((acc, point, index) => {
      return index === 0 ? `M ${point.x} ${point.y}` : `${acc} L ${point.x} ${point.y}`;
    }, '');

    const bottomY = chartHeight - paddingBottom + 5;
    const firstPoint = points[0];
    const lastPoint = points[points.length - 1];
    const aPath = `${lPath} L ${lastPoint.x} ${bottomY} L ${firstPoint.x} ${bottomY} Z`;

    return { linePath: lPath, areaPath: aPath };
  }, [points, chartHeight, paddingBottom]);

  // Handle touch / drag interaction across the chart
  const handleTouch = (event: GestureResponderEvent) => {
    const touchX = event.nativeEvent.locationX;
    // Find closest point by x coordinate
    let closestIndex = 0;
    let minDiff = Infinity;

    for (let i = 0; i < points.length; i++) {
      const diff = Math.abs(points[i].x - touchX);
      if (diff < minDiff) {
        minDiff = diff;
        closestIndex = i;
      }
    }
    setSelectedIndex(closestIndex);
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt: GestureResponderEvent) => handleTouch(evt),
      onPanResponderMove: (evt: GestureResponderEvent) => handleTouch(evt),
    }),
  ).current;

  // Active point currently touched / hovered
  const activePoint = points[selectedIndex] || points[points.length - 1];

  // Tooltip positioning directly above the point
  const tooltipWidth = 130;
  const tooltipHeight = 48;
  const clampedTooltipLeft = Math.max(
    4,
    Math.min(activePoint.x - tooltipWidth / 2, chartWidth - tooltipWidth - 4),
  );

  // Position above the point, or below if point is too close to top
  const isNearTop = activePoint.y < 55;
  const tooltipTop = isNearTop ? activePoint.y + 14 : activePoint.y - tooltipHeight - 14;

  // Display 5 representative dates along the X-axis
  const xLabels = useMemo(() => {
    if (points.length <= 5) return points;
    const step = Math.floor((points.length - 1) / 4);
    return [
      points[0],
      points[step],
      points[step * 2],
      points[step * 3],
      points[points.length - 1],
    ];
  }, [points]);

  return (
    <View style={styles.container}>
      {/* Top summary stats */}
      <View style={styles.topSummaryRow}>
        <View>
          <Text style={styles.chartPeriodTitle}>Last 30 Days Trend</Text>
          <Text style={styles.chartPeriodSub}>Touch & slide finger to inspect any date</Text>
        </View>

        <View style={styles.statsChips}>
          <View style={styles.statChip}>
            <Text style={styles.statLabel}>30D HIGH</Text>
            <Text style={styles.statValue}>₹{maxPrice.toLocaleString('en-IN')}</Text>
          </View>
          <View style={styles.statChip}>
            <Text style={styles.statLabel}>30D LOW</Text>
            <Text style={styles.statValue}>₹{minPrice.toLocaleString('en-IN')}</Text>
          </View>
        </View>
      </View>

      {/* SVG Canvas & Interactive Touch Area */}
      <View style={styles.chartWrapper} {...panResponder.panHandlers}>
        <Svg width={chartWidth} height={chartHeight}>
          <Defs>
            <LinearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor="#F3D58A" stopOpacity="0.4" />
              <Stop offset="65%" stopColor="#F3D58A" stopOpacity="0.08" />
              <Stop offset="100%" stopColor="#F3D58A" stopOpacity="0.0" />
            </LinearGradient>
          </Defs>

          {/* Grid Guideline */}
          <Line
            x1={paddingH}
            y1={paddingTop + innerHeight / 2}
            x2={chartWidth - paddingH}
            y2={paddingTop + innerHeight / 2}
            stroke="#232B3A"
            strokeDasharray="4 4"
            strokeWidth="1"
          />
          <Line
            x1={paddingH}
            y1={chartHeight - paddingBottom}
            x2={chartWidth - paddingH}
            y2={chartHeight - paddingBottom}
            stroke="#232B3A"
            strokeWidth="1"
          />

          {/* Gradient area underneath line */}
          <Path d={areaPath} fill="url(#chartGradient)" />

          {/* Main Gold Line */}
          <Path
            d={linePath}
            fill="none"
            stroke="#F3D58A"
            strokeWidth="2.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Active selection vertical line */}
          <Line
            x1={activePoint.x}
            y1={paddingTop - 10}
            x2={activePoint.x}
            y2={chartHeight - paddingBottom}
            stroke="#F3D58A"
            strokeDasharray="3 3"
            strokeWidth="1.2"
            opacity={0.7}
          />

          {/* Points on the curve */}
          {points.map((p, i) => {
            const isSelected = i === selectedIndex;
            return (
              <React.Fragment key={i}>
                {isSelected && (
                  <Circle
                    cx={p.x}
                    cy={p.y}
                    r="8.5"
                    fill="#F3D58A"
                    fillOpacity="0.3"
                  />
                )}
                <Circle
                  cx={p.x}
                  cy={p.y}
                  r={isSelected ? '5.5' : '2'}
                  fill={isSelected ? '#FFFFFF' : '#E8B958'}
                  stroke="#161A24"
                  strokeWidth={isSelected ? '2' : '1'}
                />
              </React.Fragment>
            );
          })}
        </Svg>

        {/* Floating Tooltip Callout Box directly at the point */}
        <View
          pointerEvents="none"
          style={[
            styles.tooltipBox,
            {
              left: clampedTooltipLeft,
              top: tooltipTop,
            },
          ]}
        >
          <View style={styles.tooltipHeader}>
            <Text style={styles.tooltipPrice}>
              ₹{activePoint.price.toLocaleString('en-IN')}{' '}
              <Text style={styles.tooltipPerGram}>/g</Text>
            </Text>
            {activePoint.item.change22K !== 0 && (
              <Text
                style={[
                  styles.tooltipChange,
                  activePoint.item.change22K > 0 ? styles.positiveText : styles.negativeText,
                ]}
              >
                {activePoint.item.change22K > 0
                  ? `+₹${activePoint.item.change22K}`
                  : `-₹${Math.abs(activePoint.item.change22K)}`}
              </Text>
            )}
          </View>
          <Text style={styles.tooltipDate}>{activePoint.item.date}</Text>

          {/* Tooltip pointer arrow */}
          <View
            style={[
              styles.tooltipArrow,
              isNearTop ? styles.tooltipArrowTop : styles.tooltipArrowBottom,
              { left: Math.max(10, Math.min(activePoint.x - clampedTooltipLeft - 5, tooltipWidth - 16)) },
            ]}
          />
        </View>
      </View>

      {/* 30-Day X-Axis Date Labels */}
      <View style={styles.dateLabelsRow}>
        {xLabels.map((p, idx) => (
          <Text key={idx} style={styles.dateLabelText}>
            {p.item.shortDate}
          </Text>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 10,
  },
  emptyContainer: {
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: '#8A92A6',
    fontSize: 14,
  },
  topSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  chartPeriodTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  chartPeriodSub: {
    color: '#858E9F',
    fontSize: 11,
    marginTop: 2,
  },
  statsChips: {
    flexDirection: 'row',
    gap: 6,
  },
  statChip: {
    backgroundColor: '#141822',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#262F40',
    alignItems: 'center',
  },
  statLabel: {
    color: '#71798C',
    fontSize: 9,
    fontWeight: 'bold',
  },
  statValue: {
    color: '#F3D58A',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 1,
  },
  chartWrapper: {
    position: 'relative',
    backgroundColor: '#121620',
    borderRadius: 16,
    overflow: 'visible',
    borderWidth: 1,
    borderColor: '#212735',
  },
  tooltipBox: {
    position: 'absolute',
    backgroundColor: '#1E2534',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 9,
    borderWidth: 1.2,
    borderColor: '#F3D58A',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 5,
    elevation: 8,
    zIndex: 99,
  },
  tooltipHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 6,
  },
  tooltipPrice: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  tooltipPerGram: {
    color: '#F3D58A',
    fontSize: 10,
    fontWeight: 'normal',
  },
  tooltipChange: {
    fontSize: 11,
    fontWeight: '700',
  },
  tooltipDate: {
    color: '#A2AAB8',
    fontSize: 10,
    marginTop: 1,
  },
  tooltipArrow: {
    position: 'absolute',
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  tooltipArrowBottom: {
    bottom: -6,
    borderTopWidth: 6,
    borderTopColor: '#F3D58A',
  },
  tooltipArrowTop: {
    top: -6,
    borderBottomWidth: 6,
    borderBottomColor: '#F3D58A',
  },
  positiveText: {
    color: '#65D98B',
  },
  negativeText: {
    color: '#FF6F6F',
  },
  dateLabelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    marginTop: 8,
  },
  dateLabelText: {
    color: '#71798C',
    fontSize: 11,
    fontWeight: '500',
  },
});
