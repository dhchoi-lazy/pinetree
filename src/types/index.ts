export interface Dataset {
  scholars: Scholar[];
  xueanGroups: XueanGroup[];
  dendrogram: DendrogramNode;
}

export interface Scholar {
  id: string;
  name: string;
  namePinyin: string;
  courtesy: string;
  title: string;
  xueanId: string;
  volume: number;
  section: string;
  text: string;
  umap: [number, number, number];
  tsne: [number, number, number];
}

export interface XueanGroup {
  id: string;
  name: string;
  nameEn: string;
  color: string;
  scholarCount: number;
  volumes: number[];
}

export interface DendrogramNode {
  id?: string;
  children?: [DendrogramNode, DendrogramNode];
  height: number;
}
