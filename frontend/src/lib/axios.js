import axios from "axios";

export const axiosInstance = axios.create({
  baseURL:
    import.meta.env.MODE === "development"
      ? "http://localhost:3000/api"
      : "/api",
  withCredentials: true,
  timeout: 30000, // Increased to 30 seconds for mobile networks
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add request interceptor to handle mobile-specific headers
axiosInstance.interceptors.request.use(
  (config) => {
    // Add cache control for mobile
    config.headers['Cache-Control'] = 'no-cache';
    config.headers['Pragma'] = 'no-cache';
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add response interceptor for better error handling with retry logic
axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Retry logic for network errors on mobile
    if (!error.response && !originalRequest._retry) {
      originalRequest._retry = true;
      
      // Wait a bit before retrying (mobile networks can be flaky)
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      try {
        return await axiosInstance(originalRequest);
      } catch (retryError) {
        console.error('Retry failed:', retryError);
        return Promise.reject(retryError);
      }
    }

    if (error.code === 'ECONNABORTED') {
      console.error('Request timeout - server took too long to respond');
    } else if (!error.response) {
      console.error('Network error - check your internet connection');
    }
    
    return Promise.reject(error);
  }
);
