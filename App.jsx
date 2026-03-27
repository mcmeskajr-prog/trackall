// Proposed code changes to fix infinite loading issue in DetailModal recommendations.
import React, { useEffect, useState } from 'react';

function App() {
  const [itemHistory, setItemHistory] = useState([]);
  const [loadingStates, setLoadingStates] = useState({});

  const onOpenItem = (item) => {
    // Reset loading states
    setLoadingStates((prev) => ({ ...prev, [item.id]: true }));
    setItemHistory((prev) => [...prev, item]);
  };

  const closeDetailModal = () => {
    // Reset loading states
    setLoadingStates({});
    setItemHistory([]);
  };

  useEffect(() => {
    const handleModalOpen = () => {
      // Ensure no nested modals are opened
      if (loadingStates) {
        closeDetailModal();
      }
    };

    // Logic to handle open/close
    // ...
  }, [loadingStates]);

  // Render Modal
  return (
    <DetailModal onClose={closeDetailModal} onOpenItem={onOpenItem} />
  );
}

export default App;
