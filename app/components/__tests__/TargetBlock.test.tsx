import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import TargetBlock, { TargetBlockType } from "../TargetBlock";

// Mock dependencies
jest.mock("@react-native-picker/picker", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    Picker: Object.assign(
      (props: any) => React.createElement(View, props, props.children),
      { Item: (props: any) => React.createElement(View, props, props.children) }
    )
  };
});

jest.mock("react-native-modal-datetime-picker", () => {
  return {
    __esModule: true,
    default: function MockDateTimePicker() {
      return null;
    }
  };
});

jest.mock("expo-constants", () => ({
  executionEnvironment: "bare",
}));

describe("TargetBlock", () => {
  const mockBlock: TargetBlockType = {
    id: 1,
    targetHour: 10,
    targetMinute: 30,
    deductHour: 0,
    deductMinute: 15,
    targetZone: "zone1",
    countdown: "05:00:00",
    isTargetPickerVisible: false,
    isDeductPickerVisible: false,
    isCollapsed: false,
    name: "Test Target",
    alertMinutesBefore: null,
    isAlertModalVisible: false,
    alertFired: false,
  };

  const defaultProps = {
    block: mockBlock,
    toggleTargetPicker: jest.fn(),
    toggleDeductPicker: jest.fn(),
    handleTargetConfirm: jest.fn(),
    handleDeductConfirm: jest.fn(),
    updateTargetTime: jest.fn(),
    updateDeductTime: jest.fn(),
    toggleAlertModal: jest.fn(),
    handleAlertConfirm: jest.fn(),
    handleAlertDelete: jest.fn(),
    setTargetBlocks: jest.fn(),
    zone1: "zone1",
    zone2: "zone2",
    removeBlock: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders correctly in normal mode", () => {
    const { getByText, getByPlaceholderText } = render(<TargetBlock {...defaultProps} />);

    // Check if name input is rendered
    expect(getByPlaceholderText("Target #1")).toBeTruthy();

    // Check if countdown is rendered
    expect(getByText("05:00:00")).toBeTruthy();

    // Check if controls are rendered
    expect(getByText("Target")).toBeTruthy();
    expect(getByText("10:30")).toBeTruthy();
    expect(getByText("Deduct")).toBeTruthy();
    expect(getByText("00:15")).toBeTruthy();
  });

  it("renders correctly in fullscreen mode", () => {
    const { getByText, queryByText } = render(<TargetBlock {...defaultProps} fullScreen={true} />);

    // Check if name and countdown are rendered
    expect(getByText("Test Target")).toBeTruthy();
    expect(getByText("05:00:00")).toBeTruthy();

    // Controls should not be rendered
    expect(queryByText("Target")).toBeNull();
    expect(queryByText("Deduct")).toBeNull();
  });

  it("handles expanding and collapsing controls", () => {
    const { getByText, queryByText, rerender } = render(<TargetBlock {...defaultProps} />);

    // Initially expanded
    expect(getByText("Target")).toBeTruthy();

    // Press collapse button
    const collapseButton = getByText("–");
    fireEvent.press(collapseButton);

    expect(defaultProps.setTargetBlocks).toHaveBeenCalled();

    // Simulate re-render with collapsed state
    const collapsedBlock = { ...mockBlock, isCollapsed: true };
    rerender(<TargetBlock {...defaultProps} block={collapsedBlock} />);

    // Controls should be hidden
    expect(queryByText("Target")).toBeNull();

    // Expand button should be visible
    expect(getByText("+")).toBeTruthy();
  });

  it("shows delete confirmation modal when X is pressed", () => {
    const { getByText } = render(<TargetBlock {...defaultProps} />);

    const deleteButton = getByText("X");
    fireEvent.press(deleteButton);

    // Check if confirmation modal is shown
    expect(getByText("Delete Timer")).toBeTruthy();
    expect(getByText('Delete "Test Target"?')).toBeTruthy();
  });
});