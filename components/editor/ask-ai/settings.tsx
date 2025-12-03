"use client";
import classNames from "classnames";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
// 🛠️ REMOVED DIRECT IMPORT OF getMODELS
import { PROVIDERS } from "@/lib/providers"; 

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useState, useEffect, useMemo } from "react"; 
import { useUpdateEffect } from "react-use";
import Image from "next/image";
import {
  BrainIcon,
  CheckCheck,
  ChevronDown,
  Sparkles,
  Zap,
  DollarSign,
} from "lucide-react";
import { useAi } from "@/hooks/useAi";
import { getProviders } from "../../../lib/providers-fetch";
import Loading from "@/components/loading";

// NOTE: Removing the local 'type ModelItem' definition as it clashes with the global 'ModelType'
// Instead, we will use type casting directly where needed (see line 165).


export function Settings({
  open,
  onClose,
  error,
  isFollowUp = false,
}: {
  open: boolean;
  error?: string;
  isFollowUp?: boolean;
  onClose: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  const {
    model,
    provider,
    setProvider,
    setModel,
    selectedModel,
    globalAiLoading,
    isModelsLoading: globalModelsLoading, // Use a local alias to avoid naming conflict
  } = useAi();
  
  // 🛠️ NEW STATE: Store the dynamically fetched models (using 'any' to avoid circular type dependency hell)
  const [models, setModels] = useState<any[]>([]); 
  const [isModelsLoading, setIsModelsLoading] = useState(true);

  const [isMounted, setIsMounted] = useState(false);
  const [loadingProviders, setLoadingProviders] = useState(false);

  useEffect(() => {
    setIsMounted(true);

    // 🛠️ FETCH THE MODELS ASYNCHRONOUSLY
    const fetchModels = async () => {
        setIsModelsLoading(true);
        try {
            const res = await fetch('/deepsite/api/models');
            if (!res.ok) throw new Error('Failed to fetch models');
            const fetchedModels = await res.json();
            setModels(fetchedModels);
        } catch (error) {
            console.error("Failed to load dynamic models:", error);
            setModels([]);
        } finally {
            setIsModelsLoading(false);
        }
    };
    fetchModels();
  }, []); 

  useUpdateEffect(() => {
    if (
      !["auto", "fastest", "cheapest"].includes(provider as string) &&
      !providers.includes(provider as string)
    ) {
      setProvider("auto");
    }
  }, [model, provider]);
  
  // 🛠️ PATCH 2: Correctly format the model list using useMemo and the state variable
  const formattedModels = useMemo(() => {
    const lists: any[] = [];
    const keys = new Set<string>();

    models.forEach((currentModel: any) => {
      // Check if we've already added this company name/category
      if (!keys.has(currentModel.companyName)) {
        lists.push({
          isCategory: true,
          name: currentModel.companyName,
          logo: currentModel.logo, 
        });
        keys.add(currentModel.companyName);
      }
      lists.push(currentModel);
    });
    return lists;
  }, [models]); 

  const [providers, setProviders] = useState<any[]>([]);
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());

  useEffect(() => {
    const loadProviders = async () => {
      setLoadingProviders(true);
      if (!model) { 
        setProviders([]);
        return;
      }
      try {
        const result = await getProviders(model);
        setProviders(result);
      } catch (error) {
        console.error("Failed to load providers:", error);
        setProviders([]);
      } finally {
        setLoadingProviders(false);
      }
    };

    loadProviders();
  }, [model]);

  const handleImageError = (providerId: string) => {
    setFailedImages((prev) => new Set([...prev, providerId]));
  };

  const isAnyLoading = globalAiLoading || loadingProviders || isModelsLoading;
  
  // 🛠️ FINAL FIX: Create a temporary variable with known types to satisfy the compiler check (Line 165)
  // This tells TypeScript: "Treat this selectedModel like it definitely has a label and logo."
  const modelWithLogo = selectedModel as { label: string; logo: any } | undefined;

  return (
    <Popover open={open} onOpenChange={onClose}>
      <PopoverTrigger asChild>
        <Button
          variant={open ? "default" : "outline"}
          className="!rounded-md"
          disabled={isAnyLoading} // Use combined loading state
          size="xs"
        >
          {/* 🛠️ Using the safe, casted variable 'modelWithLogo' */}
          {modelWithLogo?.logo && (
            <Image
              src={modelWithLogo.logo}
              alt={modelWithLogo.label}
              className={`size-3.5 ${open ? "" : "filter invert"}`}
              width={20}
              height={20}
            />
          )}
          <span className="truncate max-w-[120px]">
            {isMounted
              ? selectedModel?.label?.split(" ").join("-").toLowerCase()
              : "..."}
          </span>
          <ChevronDown className="size-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="!rounded-2xl p-0 !w-96 overflow-hidden !bg-neutral-900"
        align="center"
      >
        <header className="flex items-center justify-center text-sm px-4 py-3 border-b gap-2 bg-neutral-950 border-neutral-800 font-semibold text-neutral-200">
          Customize Settings
        </header>
        <main className="px-4 pt-5 pb-6 space-y-5">
          {error !== "" && (
            <p className="text-red-500 text-sm font-medium mb-2 flex items-center justify-between bg-red-500/10 p-2 rounded-md">
              {error}
            </p>
          )}
          <label className="block">
            <p className="text-neutral-300 text-sm mb-2.5">Choose a model</p>
            <Select defaultValue={model} onValueChange={setModel} disabled={isModelsLoading}>
              <SelectTrigger className="w-full">
                {isModelsLoading ? <Loading overlay={false} /> : <SelectValue placeholder="Select a model" />}
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {formattedModels.map((item: any) => {
                    if ("isCategory" in item) {
                      return (
                        <SelectLabel
                          key={item.name}
                          className="flex items-center gap-1"
                        >
                          {item.name}
                        </SelectLabel>
                      );
                    }
                    const {
                      value,
                      label,
                      isNew = false,
                      isThinker = false,
                    } = item;
                    return (
                      <SelectItem
                        key={value}
                        value={value}
                        className=""
                        disabled={isThinker && isFollowUp}
                      >
                        {label}
                        {isNew && (
                          <span className="text-xs bg-gradient-to-br from-sky-400 to-sky-600 text-white rounded-full px-1.5 py-0.5">
                            New
                          </span>
                        )}
                      </SelectItem>
                    );
                  })}
                </SelectGroup>
              </SelectContent>
            </Select>
          </label>
          <div className="flex flex-col gap-3">
            <div>
              <p className="text-neutral-300 text-sm mb-1">Provider Mode</p>
              <p className="text-neutral-400 text-xs mb-3 leading-relaxed">
                Choose how we select providers:{" "}
                <span className="px-1.5 py-0.5 rounded bg-pink-500/10 text-pink-500">
                  Auto
                </span>{" "}
                (smart),{" "}
                <span className="px-1.5 py-0.5 rounded bg-yellow-500/10 text-yellow-500">
                  Fastest
                </span>{" "}
                (speed), or{" "}
                <span className="px-1.5 py-0.5 rounded bg-green-500/10 text-green-500">
                  Cheapest
                </span>{" "}
                (cost).
              </p>
              <div className="grid grid-cols-3 gap-1 bg-neutral-800 p-1 rounded-full">
                <button
                  className={classNames(
                    "flex flex-col items-center justify-center cursor-pointer py-1.5 rounded-full transition-all duration-200",
                    {
                      "bg-white text-neutral-800": provider === "auto",
                      "text-neutral-400 hover:text-neutral-200":
                        provider !== "auto",
                    }
                  )}
                  onClick={() => setProvider("auto")}
                >
                  <Sparkles
                    className={classNames("size-3.5 mb-0.5", {
                      "text-pink-400": provider !== "auto",
                    })}
                  />
                  <span className="text-[10px] font-medium">Auto</span>
                </button>
                <button
                  className={classNames(
                    "flex flex-col items-center justify-center cursor-pointer py-1.5 rounded-full transition-all duration-200",
                    {
                      "bg-white text-neutral-800": provider === "fastest",
                      "text-neutral-400 hover:text-neutral-200":
                        provider !== "fastest",
                    }
                  )}
                  onClick={() => setProvider("fastest")}
                >
                  <Zap
                    className={classNames("size-3.5 mb-0.5", {
                      "text-yellow-400": provider !== "fastest",
                    })}
                  />
                  <span className="text-[10px] font-medium">Fastest</span>
                </button>
                <button
                  className={classNames(
                    "flex flex-col items-center justify-center cursor-pointer py-1.5 rounded-full transition-all duration-200",
                    {
                      "bg-white text-neutral-800": provider === "cheapest",
                      "text-neutral-400 hover:text-neutral-200":
                        provider !== "cheapest",
                    }
                  )}
                  onClick={() => setProvider("cheapest")}
                >
                  <DollarSign
                    className={classNames("size-3.5 mb-0.5", {
                      "text-green-400": provider !== "cheapest",
                    })}
                  />
                  <span className="text-[10px] font-medium">Cheapest</span>
                </button>
              </div>
            </div>
            <label className="block">
              <p className="text-neutral-300 text-sm mb-2">
                Or choose a specific provider
              </p>
              <div className="grid grid-cols-2 gap-1.5 relative">
                {loadingProviders ? (
                  <Loading overlay={false} />
                ) : (
                  providers.map((id: string) => (
                    <Button
                      key={id}
                      variant={id === provider ? "default" : "secondary"}
                      size="sm"
                      onClick={() => {
                        setProvider(id);
                      }}
                    >
                      {failedImages.has(id) ? (
                        <BrainIcon className="size-4 mr-2" />
                      ) : (
                        <Image
                          src={`/deepsite/providers/${id}.svg`}
                          alt={id}
                          className="size-5 mr-2"
                          width={20}
                          height={20}
                          onError={() => handleImageError(id)}
                        />
                      )}
                      {PROVIDERS?.[id as keyof typeof PROVIDERS]?.name || id}
                      {id === provider && (
                        <CheckCheck className="ml-2 size-4 text-blue-500" />
                      )}
                    </Button>
                  ))
                )}
              </div>
            </label>
          </div>
        </main>
      </PopoverContent>
    </Popover>
  );
}
