export const Loader = () => {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-gray-50">
      <div className="loader"></div>
      <style>{`
        .loader {
          border: 4px solid rgba(0, 0, 0, 0.1);
          width: 40px;
          height: 40px;
          border-radius: 50%;
          border-left-color: #0ea5e9;
          animation: spin 1s ease-in-out infinite;
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};
