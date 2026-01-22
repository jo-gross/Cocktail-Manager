import React, { useContext, useState } from 'react';
import { ModalContext } from '@lib/context/ModalContextProvider';
import { CocktailExportStructure } from '../../types/CocktailExportStructure';
import { UploadAndPreviewStep } from '../cocktail-import/UploadAndPreviewStep';
import { EntityMappingStep } from '../cocktail-import/EntityMappingStep';
import { CocktailReviewStep } from '../cocktail-import/CocktailReviewStep';
import { ConfirmationStep } from '../cocktail-import/ConfirmationStep';

interface EntityMapping {
  exportId: string;
  decision: 'use-existing' | 'create-new';
  existingId?: string;
  newEntityData?: any; // Data for creating new entity (if decision is 'create-new')
}

interface CocktailMapping {
  exportId: string;
  decision: 'import' | 'skip' | 'rename' | 'overwrite';
  newName?: string;
  overwriteId?: string;
}

export interface MappingDecisions {
  glasses: EntityMapping[];
  garnishes: EntityMapping[];
  ingredients: EntityMapping[];
  units: EntityMapping[];
  ice: EntityMapping[];
  stepActions: EntityMapping[];
  cocktails: CocktailMapping[];
}

interface CocktailImportWizardModalProps {
  workspaceId: string;
  onImportComplete: () => void;
}

export default function CocktailImportWizardModal({ workspaceId, onImportComplete }: CocktailImportWizardModalProps) {
  const modalContext = useContext(ModalContext);
  const [currentStep, setCurrentStep] = useState(1);
  const [exportData, setExportData] = useState<CocktailExportStructure | null>(null);
  const [selectedCocktailIds, setSelectedCocktailIds] = useState<Set<string>>(new Set());
  const [mappingDecisions, setMappingDecisions] = useState<MappingDecisions | null>(null);

  const handleClose = () => {
    modalContext.closeModal();
  };

  const handleNext = () => {
    setCurrentStep((prev) => Math.min(prev + 1, 4));
  };

  const handleBack = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  const handleUploadComplete = (data: CocktailExportStructure, selectedIds: Set<string>) => {
    setExportData(data);
    setSelectedCocktailIds(selectedIds);
    handleNext();
  };

  const handleMappingComplete = (decisions: MappingDecisions) => {
    setMappingDecisions(decisions);
    handleNext();
  };

  const handleReviewComplete = (cocktailMappings: CocktailMapping[]) => {
    if (mappingDecisions) {
      setMappingDecisions({
        ...mappingDecisions,
        cocktails: cocktailMappings,
      });
    }
    handleNext();
  };

  const handleImportComplete = () => {
    onImportComplete();
    handleClose();
  };

  return (
    <div className={'flex flex-col gap-4'}>
      <div className={'text-2xl font-bold'}>Cocktails importieren</div>

      {/* Progress indicator */}
      <div className={'flex items-center justify-between'}>
        <div className={'flex flex-1 items-center'}>
          <div className={`flex h-8 w-8 items-center justify-center rounded-full ${currentStep >= 1 ? 'bg-primary text-primary-content' : 'bg-base-300'}`}>
            1
          </div>
          <div className={`h-1 flex-1 ${currentStep >= 2 ? 'bg-primary' : 'bg-base-300'}`}></div>
        </div>
        <div className={'flex flex-1 items-center'}>
          <div className={`flex h-8 w-8 items-center justify-center rounded-full ${currentStep >= 2 ? 'bg-primary text-primary-content' : 'bg-base-300'}`}>
            2
          </div>
          <div className={`h-1 flex-1 ${currentStep >= 3 ? 'bg-primary' : 'bg-base-300'}`}></div>
        </div>
        <div className={'flex flex-1 items-center'}>
          <div className={`flex h-8 w-8 items-center justify-center rounded-full ${currentStep >= 3 ? 'bg-primary text-primary-content' : 'bg-base-300'}`}>
            3
          </div>
          <div className={`h-1 flex-1 ${currentStep >= 4 ? 'bg-primary' : 'bg-base-300'}`}></div>
        </div>
        <div className={`flex h-8 w-8 items-center justify-center rounded-full ${currentStep >= 4 ? 'bg-primary text-primary-content' : 'bg-base-300'}`}>4</div>
      </div>

      {/* Step labels */}
      <div className={'flex justify-between text-xs'}>
        <div className={'flex-1 text-center'}>Upload</div>
        <div className={'flex-1 text-center'}>Mapping</div>
        <div className={'flex-1 text-center'}>Review</div>
        <div className={'flex-1 text-center'}>Import</div>
      </div>

      <div className={'divider my-0'}></div>

      {/* Step content */}
      <div className={'min-h-[400px]'}>
        {currentStep === 1 && <UploadAndPreviewStep workspaceId={workspaceId} onComplete={handleUploadComplete} onCancel={handleClose} />}
        {currentStep === 2 && exportData && (
          <EntityMappingStep
            workspaceId={workspaceId}
            exportData={exportData}
            selectedCocktailIds={selectedCocktailIds}
            onComplete={handleMappingComplete}
            onBack={handleBack}
          />
        )}
        {currentStep === 3 && exportData && mappingDecisions && (
          <CocktailReviewStep
            workspaceId={workspaceId}
            exportData={exportData}
            selectedCocktailIds={selectedCocktailIds}
            onComplete={handleReviewComplete}
            onBack={handleBack}
          />
        )}
        {currentStep === 4 && exportData && mappingDecisions && (
          <ConfirmationStep
            workspaceId={workspaceId}
            exportData={exportData}
            mappingDecisions={mappingDecisions}
            selectedCocktailIds={selectedCocktailIds}
            onComplete={handleImportComplete}
            onBack={handleBack}
          />
        )}
      </div>
    </div>
  );
}
