'use strict';

import path from 'path';
import fs from 'fs';
import { readFile } from 'fs/promises';
import yargs from 'yargs';
import chalk from 'chalk';
import { fileURLToPath } from 'url';

// Constantes para posições de dados específicos no arquivo CNAB
const DEFAULT_CNAB_FILE = 'cnabExample.rem';

const COMPANY_NAME_START = 33;
const COMPANY_NAME_END = 73;
const COMPANY_ADDRESS_STREET_START = 73;
const COMPANY_ADDRESS_STREET_END = 113;
const COMPANY_ADDRESS_DISTRICT_START = 113;
const COMPANY_ADDRESS_DISTRICT_END = 128;
const COMPANY_ADDRESS_ZIP_CODE_START = 128;
const COMPANY_ADDRESS_ZIP_CODE_END = 136;
const COMPANY_ADDRESS_STATE_START = 136;
const COMPANY_ADDRESS_STATE_END = 151;
const COMPANY_ADDRESS_STATE_ACRONYM_START = 151;
const COMPANY_ADDRESS_STATE_ACRONYM_END = 153;

// Função para configurar as opções do CLI
function configureCLI() {
  return yargs(process.argv.slice(2))
    .usage('Uso: $0 [options]')
    .option("f", { alias: "from", describe: "Posição inicial de pesquisa da linha do Cnab", type: "number" })
    .option("t", { alias: "to", describe: "Posição final de pesquisa da linha do Cnab", type: "number" })
    .option("s", { alias: "segment", describe: "Tipo de segmento", type: "string" })
    .option("n", { alias: "companyName", describe: "Nome da empresa de pesquisa da linha do Cnab", type: "string" })
    .option("c", { alias: "cnabFile", describe: "Caminho do arquivo Cnab", type: "string" })
    .check(argv => {
      if (argv.companyName && (argv.from || argv.to || argv.segment)) {
        throw new Error('A opção -n (companyName) não pode ser utilizada com as opções -f, -t e -s.');
      } else if (!argv.companyName && (!argv.from || !argv.to || !argv.segment)) {
        throw new Error('Ao enviar uma das opções -f, -t e -s todas devem ser informadas.');
      }

      
      return true;
    })
    .example('$0 -f 21 -t 34 -s p', 'Lista a linha e campo que from e to do cnab')
    .example('$0 -f 21 -t 34 -s p -c ./caminho/do/seu/arquivo.cnab', 'Lista a linha e campo que from e to do cnab a partir de um arquivo específico fornecido')
    .example('$0 -n empresa', 'Lista as empresas encontradas pelo nome fornecido.')
    .example('$0 -n empresa -c ./caminho/do/seu/arquivo.cnab', 'Lista as empresas encontradas pelo nome a partir de um arquivo específico fornecido')
    .argv;
}

// Função principal para processar o arquivo CNAB
async function processCNABFile(options) {
  const { from, to, segment, companyName, cnabFile } = options;
  
  try {
    const file = resolveFilePath(cnabFile);
    checkFileExists(file);

    const fileContent = await readFile(file, 'utf8');
    const cnabContent = fileContent.split('\n').slice(2, -2);

    if (companyName) {
      searchCompanyName(cnabContent, companyName);
    } else {
      searchSegment(cnabContent, segment, from, to);
    }
  } catch (error) {
    console.error("Erro ao processar o arquivo CNAB:", error);
  }
}

// Função para criar uma mensagem de log
function createLogMessage(segment, segmentType, from, to) {
  return `
    ----- Cnab linha ${segmentType} -----
    
    posição from: ${chalk.inverse.bgBlack(from)}
    
    posição to: ${chalk.inverse.bgBlack(to)}
    
    item isolado: ${chalk.inverse.bgBlack(segment.substring(from, to))}
    
    item dentro da linha ${segmentType.toUpperCase()}: 
      ${segment.substring(0, from)}${chalk.inverse.bgBlack(segment.substring(from, to))}${segment.substring(to)}
    
    ----- FIM ------
  `;
}

// Função auxiliar para resolver o caminho do arquivo
function resolveFilePath(cnabFile) {
  if (cnabFile) {
    return path.resolve(cnabFile);
  } else {
    console.info(`Nenhum arquivo foi especificado, o arquivo '${DEFAULT_CNAB_FILE}' será utilizado para a realização da rotina`);
    
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);

    return path.resolve(__dirname, DEFAULT_CNAB_FILE);
  }
}

// Função auxiliar para verificar a existência do arquivo
function checkFileExists(file) {
  if (!fs.existsSync(file)) {
    throw new Error(`Erro: Arquivo não encontrado em: ${file}`);
  }
}

// Função para buscar o nome da empresa
function searchCompanyName(cnabContent, companyName) {
  const extractedData = [];

  cnabContent.forEach((segment, index) => {
    const nameRange = segment.substring(COMPANY_NAME_START, COMPANY_NAME_END).trim().toUpperCase();
    const foundCompanyName = nameRange.includes(companyName.toUpperCase());

    if (foundCompanyName) {
      const segmentType = segment[13];
      const segmentLine = index + 2;

      console.log(createLogMessage(segment, segmentType, COMPANY_NAME_START, COMPANY_NAME_END));

      const company = segment.substring(COMPANY_NAME_START, COMPANY_NAME_END).trim();
      const street = segment.substring(COMPANY_ADDRESS_STREET_START, COMPANY_ADDRESS_STREET_END).trim();
      const district = segment.substring(COMPANY_ADDRESS_DISTRICT_START, COMPANY_ADDRESS_DISTRICT_END).trim();
      const zipCode = segment.substring(COMPANY_ADDRESS_ZIP_CODE_START, COMPANY_ADDRESS_ZIP_CODE_END).trim();
      const state = segment.substring(COMPANY_ADDRESS_STATE_START, COMPANY_ADDRESS_STATE_END).trim();
      const stateAcronym = segment.substring(COMPANY_ADDRESS_STATE_ACRONYM_START, COMPANY_ADDRESS_STATE_ACRONYM_END).trim();
      
      const extractedObject = {
        Empresa: company,
        Endereço: {
          Rua: street,
          Bairro: district,
          CEP: zipCode,
          Estado: state,
          'Sigla do Estado': stateAcronym
        },
        Posições: {
          Segmento: segmentType,
          Linha: segmentLine,
          De: COMPANY_NAME_START,
          Para: COMPANY_ADDRESS_STATE_ACRONYM_END,
        }
      }
      extractedData.push(extractedObject);
    }
  });

  if (extractedData.length > 0) {
    saveExtractedDataAsJSON(extractedData);
  } else {
    console.log(`Não foram encontradas empresas que correspondem ao filtro: ${companyName}`)
  }
}

// Função para buscar pelo segmento
function searchSegment(cnabContent, segment, from, to) {
  const findSegment = cnabContent.find(line => line[13].toUpperCase() === segment.toUpperCase());
  
  if (findSegment) {
    console.log(createLogMessage(findSegment, segment.toUpperCase(), from, to));
  } else {
    console.log(`Segmento ${segment} não encontrado.`);
  }
}

// Função para salvar os dados extraídos como JSON
function saveExtractedDataAsJSON(extractedData) {
  const directory = path.join(new URL('.', import.meta.url).pathname, 'extractedDatas');
  const date = new Date().toISOString();

  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory, { recursive: true });
  }

  const filename = `exportedData_${date}.json`;
  const jsonFilePath = path.join(directory, filename);

  fs.writeFileSync(jsonFilePath, JSON.stringify(extractedData, null, 2), 'utf-8');
  console.log(`Os dados do arquivo foram extraídos para: ${jsonFilePath}`);
}

// Execução do script
const options = configureCLI();
processCNABFile(options);
