import axios from "axios";

const API_URL = "http://localhost:8000";

// Create an axios instance
const api = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Fetch the entire workspace (boxes and arrows)
export const fetchWorkspace = async () => {
  try {
    const response = await api.get("/workspace");
    return response.data;
  } catch (error) {
    console.error("Error fetching workspace:", error);
    throw error;
  }
};

// Save the entire workspace
export const saveWorkspace = async (workspace: any) => {
  try {
    const response = await api.post("/workspace", workspace);
    return response.data;
  } catch (error) {
    console.error("Error saving workspace:", error);
    throw error;
  }
};

// Execute code in a specific box
export const executeCode = async (
  boxId: string,
  code: string,
  ancestors: any[],
) => {
  try {
    const response = await api.post("/execute", {
      boxId,
      code,
      ancestors,
    });
    return response.data;
  } catch (error) {
    console.error("Error executing code:", error);
    throw error;
  }
};

export default {
  fetchWorkspace,
  saveWorkspace,
  executeCode,
};
