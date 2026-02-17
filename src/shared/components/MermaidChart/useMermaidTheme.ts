import { theme } from "antd";
import { useEffect, useRef } from "react";
import mermaid from "mermaid";
import { useMermaidSettings } from "../../store/mermaidSettingsStore";

/**
 * Hook to dynamically update Mermaid theme based on Ant Design theme
 *
 * This hook listens to Ant Design theme changes and reconfigures Mermaid
 * to match the current theme (light/dark).
 *
 * IMPORTANT: Call this hook at the app level (MainLayout.tsx) to ensure global theme updates
 */
export const useMermaidTheme = () => {
  const { token } = theme.useToken();
  const userSettings = useMermaidSettings();
  const previousCheckRef = useRef<string>("");

  useEffect(() => {
    // Create a check string to detect actual changes
    const isDark = isColorDark(token.colorBgContainer);
    const checkString = `${isDark}-${userSettings.theme}-${JSON.stringify(userSettings.themeVariables)}`;

    // Skip if nothing changed
    if (previousCheckRef.current === checkString) {
      return;
    }

    previousCheckRef.current = checkString;

    console.log(
      `🎨 Updating Mermaid theme: ${userSettings.theme} (isDark: ${isDark})`,
    );

    // Determine which theme to use
    // If user selected 'default' or 'neutral', we auto-switch based on app theme
    let activeTheme = userSettings.theme;
    if (userSettings.theme === "default" || userSettings.theme === "neutral") {
      activeTheme = isDark ? "dark" : userSettings.theme;
    }

    mermaid.initialize({
      startOnLoad: false,
      theme: activeTheme,
      securityLevel: "loose",
      suppressErrorRendering: true,
      fontSize: userSettings.fontSize,

      // Apply custom theme variables if provided
      themeVariables:
        Object.keys(userSettings.themeVariables).length > 0
          ? userSettings.themeVariables
          : undefined,

      // Flowchart with user settings
      flowchart: {
        useMaxWidth: userSettings.useMaxWidth,
        htmlLabels: true,
        curve: userSettings.flowchartCurve,
        nodeSpacing: userSettings.flowchartNodeSpacing,
        rankSpacing: userSettings.flowchartRankSpacing,
      },

      // Sequence with user settings
      sequence: {
        useMaxWidth: userSettings.useMaxWidth,
        diagramMarginX: 10,
        diagramMarginY: 10,
        actorMargin: userSettings.sequenceActorMargin,
        width: userSettings.sequenceWidth,
        height: userSettings.sequenceHeight,
        boxMargin: 10,
        boxTextMargin: 5,
        noteMargin: 10,
        messageMargin: userSettings.sequenceMessageMargin,
        mirrorActors: true,
        bottomMarginAdj: 1,
        rightAngles: false,
        showSequenceNumbers: false,
      },

      // Gantt with user settings
      gantt: {
        useMaxWidth: userSettings.useMaxWidth,
        leftPadding: 75,
        gridLineStartPadding: 35,
        barHeight: userSettings.ganttBarHeight,
        barGap: 4,
        topPadding: userSettings.ganttTopPadding,
      },

      journey: {
        useMaxWidth: userSettings.useMaxWidth,
        diagramMarginX: 50,
        diagramMarginY: 10,
        leftMargin: 150,
        width: 150,
        height: 50,
        boxMargin: 10,
        boxTextMargin: 5,
        noteMargin: 10,
        messageMargin: 35,
        messageAlign: "center",
      },

      timeline: {
        useMaxWidth: userSettings.useMaxWidth,
        diagramMarginX: 50,
        diagramMarginY: 10,
        leftMargin: 150,
        width: 150,
        height: 50,
        boxMargin: 10,
        boxTextMargin: 5,
        noteMargin: 10,
        messageMargin: 35,
      },

      gitGraph: {
        useMaxWidth: userSettings.useMaxWidth,
        showBranches: true,
        showCommitLabel: true,
      },

      c4: {
        useMaxWidth: userSettings.useMaxWidth,
        diagramMarginX: 50,
        diagramMarginY: 10,
        c4ShapeMargin: 50,
        c4ShapePadding: 20,
        width: 216,
        height: 60,
        boxMargin: 10,
      },

      sankey: {
        useMaxWidth: userSettings.useMaxWidth,
      },

      xyChart: {
        useMaxWidth: userSettings.useMaxWidth,
      },

      block: {
        useMaxWidth: userSettings.useMaxWidth,
        padding: 8,
      },
    });
  }, [token, userSettings]);
};

/**
 * Determine if a color is dark based on its luminance
 */
function isColorDark(color: string): boolean {
  // Handle hex colors
  if (color.startsWith("#")) {
    const hex = color.slice(1);
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance < 0.5;
  }

  // Handle rgb/rgba colors
  const rgbMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (rgbMatch) {
    const r = parseInt(rgbMatch[1]);
    const g = parseInt(rgbMatch[2]);
    const b = parseInt(rgbMatch[3]);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance < 0.5;
  }

  // Default to light mode if we can't parse
  return false;
}
