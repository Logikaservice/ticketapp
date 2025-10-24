// hooks/useApi.js

import { useState } from 'react';

export const useApi = (getAuthHeader) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const apiCall = async (url, options = {}) => {
    setLoading(true);
    setError(null);

    try {
      const authHeaders = getAuthHeader();
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
          ...options.headers
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const get = (url, options = {}) => {
    return apiCall(url, { ...options, method: 'GET' });
  };

  const post = (url, data, options = {}) => {
    return apiCall(url, {
      ...options,
      method: 'POST',
      body: JSON.stringify(data)
    });
  };

  const put = (url, data, options = {}) => {
    return apiCall(url, {
      ...options,
      method: 'PUT',
      body: JSON.stringify(data)
    });
  };

  const patch = (url, data, options = {}) => {
    return apiCall(url, {
      ...options,
      method: 'PATCH',
      body: JSON.stringify(data)
    });
  };

  const del = (url, options = {}) => {
    return apiCall(url, { ...options, method: 'DELETE' });
  };

  return {
    loading,
    error,
    apiCall,
    get,
    post,
    put,
    patch,
    delete: del
  };
};
