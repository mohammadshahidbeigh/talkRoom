// client/src/routes/index.tsx
import React from "react";
import {Routes, Route, Navigate} from "react-router-dom";
import ProtectedRoute from "./ProtectedRoute";
import Dashboard from "../components/Dashboard";
import ChatRoom from "../components/Chat/ChatRoom";
import VideoRoom from "../components/Video/VideoRoom";
import Login from "../components/Auth/Login";
import Register from "../components/Auth/Register";
import UserProfile from "../components/UserProfile";

const AppRoutes: React.FC = () => {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/chat"
        element={
          <ProtectedRoute>
            <ChatRoom />
          </ProtectedRoute>
        }
      />
      <Route
        path="/video"
        element={
          <ProtectedRoute>
            <VideoRoom />
          </ProtectedRoute>
        }
      />
      <Route
        path="/video/:roomId"
        element={
          <ProtectedRoute>
            <VideoRoom />
          </ProtectedRoute>
        }
      />
      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <UserProfile username="" email="" />
          </ProtectedRoute>
        }
      />
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
};

export default AppRoutes;
