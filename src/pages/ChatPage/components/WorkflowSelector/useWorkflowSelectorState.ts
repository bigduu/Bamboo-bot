import { useCallback, useEffect, useRef, useState } from "react";
import {
  WorkflowManagerService,
  type WorkflowMetadata,
} from "../../services/WorkflowManagerService";

interface UseWorkflowSelectorStateProps {
  visible: boolean;
  searchText: string;
  onSelect: (workflow: { name: string; content: string }) => void;
  onCancel: () => void;
  onAutoComplete?: (workflowName: string) => void;
}

export const useWorkflowSelectorState = ({
  visible,
  searchText,
  onSelect,
  onCancel,
  onAutoComplete,
}: UseWorkflowSelectorStateProps) => {
  const [workflows, setWorkflows] = useState<WorkflowMetadata[]>([]);
  const [filteredWorkflows, setFilteredWorkflows] = useState<
    WorkflowMetadata[]
  >([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const selectedItemRef = useRef<HTMLDivElement>(null);
  const workflowsRef = useRef<WorkflowMetadata[]>([]);
  const selectedIndexRef = useRef(0);
  const onSelectRef = useRef(onSelect);
  const onCancelRef = useRef(onCancel);
  const onAutoCompleteRef = useRef(onAutoComplete);
  const workflowServiceRef = useRef(WorkflowManagerService.getInstance());

  useEffect(() => {
    workflowsRef.current = filteredWorkflows;
  }, [filteredWorkflows]);

  useEffect(() => {
    selectedIndexRef.current = selectedIndex;
  }, [selectedIndex]);

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    onCancelRef.current = onCancel;
  }, [onCancel]);

  useEffect(() => {
    onAutoCompleteRef.current = onAutoComplete;
  }, [onAutoComplete]);

  useEffect(() => {
    if (!visible) return;

    const fetchWorkflows = async () => {
      setIsLoading(true);
      try {
        const fetchedWorkflows = await workflowServiceRef.current.listWorkflows();
        console.log("[WorkflowSelector] Fetched workflows:", fetchedWorkflows);
        setWorkflows(fetchedWorkflows);
        setSelectedIndex(0);
      } catch (error) {
        console.error("[WorkflowSelector] Failed to fetch workflows:", error);
        setWorkflows([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchWorkflows();
  }, [visible]);

  useEffect(() => {
    const filtered = workflows.filter((workflow) =>
      workflow.name.toLowerCase().includes(searchText.toLowerCase()),
    );
    setFilteredWorkflows(filtered);
    setSelectedIndex(0);
  }, [workflows, searchText]);

  useEffect(() => {
    if (!selectedItemRef.current || !containerRef.current) return;
    const container = containerRef.current;
    const selectedItem = selectedItemRef.current;

    const containerRect = container.getBoundingClientRect();
    const selectedRect = selectedItem.getBoundingClientRect();

    if (selectedRect.top < containerRect.top) {
      selectedItem.scrollIntoView({ block: "start", behavior: "smooth" });
    } else if (selectedRect.bottom > containerRect.bottom) {
      selectedItem.scrollIntoView({ block: "end", behavior: "smooth" });
    }
  }, [selectedIndex, filteredWorkflows]);

  const handleWorkflowSelect = useCallback(async (workflowName: string) => {
    try {
      const workflow = await workflowServiceRef.current.getWorkflow(workflowName);

      onSelectRef.current({
        name: workflow.name,
        content: workflow.content,
      });
    } catch (error) {
      console.error(
        `[WorkflowSelector] Failed to load workflow '${workflowName}':`,
        error,
      );
      onSelectRef.current({ name: workflowName, content: "" });
    }
  }, []);

  useEffect(() => {
    if (!visible) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      switch (event.key) {
        case "ArrowDown":
        case "n":
          if (event.key === "n" && !event.ctrlKey) break;
          event.preventDefault();
          event.stopPropagation();
          setSelectedIndex((prev) =>
            prev < workflowsRef.current.length - 1 ? prev + 1 : 0,
          );
          break;
        case "ArrowUp":
        case "p":
          if (event.key === "p" && !event.ctrlKey) break;
          event.preventDefault();
          event.stopPropagation();
          setSelectedIndex((prev) =>
            prev > 0 ? prev - 1 : Math.max(workflowsRef.current.length - 1, 0),
          );
          break;
        case "Enter":
          event.preventDefault();
          event.stopPropagation();
          if (workflowsRef.current[selectedIndexRef.current]) {
            handleWorkflowSelect(workflowsRef.current[selectedIndexRef.current].name);
          }
          break;
        case " ":
        case "Tab":
          event.preventDefault();
          event.stopPropagation();
          if (workflowsRef.current[selectedIndexRef.current] && onAutoCompleteRef.current) {
            onAutoCompleteRef.current(workflowsRef.current[selectedIndexRef.current].name);
          }
          break;
        case "Escape":
          event.preventDefault();
          event.stopPropagation();
          onCancelRef.current();
          break;
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleWorkflowSelect, visible]);

  return {
    containerRef,
    selectedItemRef,
    filteredWorkflows,
    selectedIndex,
    setSelectedIndex,
    isLoading,
    handleWorkflowSelect,
  };
};
