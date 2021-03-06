import * as DCL from 'metaverse-api'
import { setState, getState } from './State'
import { Vector2Component } from 'metaverse-api'
import { Tile, ITileProps } from './components/Tile'
import { Trap, ITrapProps, TrapState } from './components/Trap'
import { Creep, ICreepProps } from './components/Creep'
import { ScoreBoard } from './components/ScoreBoard'
import { Button, ButtonState } from './components/Button'

function sleep(ms: number): Promise<void> 
{
  return new Promise(resolve => setTimeout(resolve, ms));
} 
let spawnInterval: NodeJS.Timer;
let objectCounter = 0;

export default class CreepsScene extends DCL.ScriptableScene
{
  sceneDidMount() 
  {
    if(getState().path.length == 0)
    {
      this.newGame();
    }
    else
    {
      for(const trap of getState().traps)
      {
        this.subToTrap(trap);
      }
    }

    this.eventSubscriber.on("newGame_click", async () =>
    {
      let startButton = getState().startButton;
      startButton.state = ButtonState.Pressed;
      setState({startButton});
      await sleep(500);
      this.newGame();
      startButton.state = ButtonState.Normal;
      setState({startButton});
    });
  }

  newGame()
  {
    for(let creep of getState().creeps)
    {
      creep.isDead = true;
    }

    while(true)
    {
      try 
      {
        setState({
          path: generatePath(),
          creeps: [],
          traps: [],
          score: {humanScore: 0, creepScore: 0},
        });
        this.spawnTrap();
        this.spawnTrap();
  
        break;
      }
      catch {}
    }
    clearInterval(spawnInterval);
    spawnInterval = setInterval(() =>
    {
      this.spawnCreep();
    }, 3000 + Math.random() * 17000);
  }

  async spawnCreep()
  {
    for(const creep of getState().creeps)
    {
      if(JSON.stringify(creep.gridPosition) == JSON.stringify(getStartPosition()))
      {
        return;
      }
    }

    let creep: ICreepProps = {
      id: "Creep" + objectCounter++,
      gridPosition: getStartPosition(),
      isDead: false,
    };
    setState({creeps: [...getState().creeps, creep]});

    let pathIndex = 1;
    while(true)
    {
      if(creep.isDead)
      {
        return;
      }

      if(pathIndex >= getState().path.length)
      {
        this.kill(creep);

        let score = getState().score;
        score.creepScore++;
        setState({score});
      }
      else
      {
        creep.gridPosition = getState().path[pathIndex];
        pathIndex++;        
        setState({creeps: getState().creeps});
      }

      await sleep(2000);
    }
  }

  async kill(creep: ICreepProps)
  {
    creep.isDead = true;
    setState({creeps: getState().creeps});

    await sleep(2000);
    let creeps = getState().creeps.slice();
    creeps.splice(creeps.indexOf(creep), 1);
    setState({creeps});
  }
  
  spawnTrap()
  {
    let trap: ITrapProps = {
      id: "Trap" + objectCounter++,
      gridPosition: this.randomTrapPosition(),
      trapState: TrapState.Available,
    };
    setState({traps: [...getState().traps, trap]});
    this.subToTrap(trap);
  }

  subToTrap(trap: ITrapProps)
  {
    this.eventSubscriber.on(trap.id + "LeverLeft_click", () =>
    {
      if(trap.trapState != TrapState.Available)
      {
        return;
      }
      trap.trapState = TrapState.PreparedOne;
      setState({traps: getState().traps});
    });

    this.eventSubscriber.on(trap.id + "LeverRight_click", async () =>
    {
      if(trap.trapState != TrapState.PreparedOne)
      {
        return;
      }
      trap.trapState = TrapState.PreparedBoth;
      setState({traps: getState().traps});

      await sleep(1000);
      trap.trapState = TrapState.Fired;
      setState({traps:  getState().traps});
      let counter = 0;

      while(true)
      {
        await sleep(100);
        
        for(const entity of getState().creeps)
        {
          if(JSON.stringify(entity.gridPosition) == JSON.stringify(trap.gridPosition) && !entity.isDead)
          {
            this.kill(entity);

            let score = getState().score;
            score.humanScore++;
            setState({score});
          }
        }
        if(counter++ > 10)
        {
          trap.trapState = TrapState.NotAvailable;
          setState({traps: getState().traps});
          
          await sleep(1000);
          let traps = getState().traps.slice();
          traps.splice(traps.indexOf(trap), 1)
          setState({traps});
          
          await sleep(1000);
          this.spawnTrap(); 

          break;
        }
      };
    });
  }

  randomTrapPosition()
  {
    let counter = 0;
    while(true)
    {
      if(counter++ > 1000)
      {
        throw new Error("Invalid path, try again");
      }

      const position = {x: Math.floor(Math.random() * 19), y: Math.floor(Math.random() * 19)};
      if(getState().path.find((p) => p.x == position.x && p.y == position.y)
        && !getState().path.find((p) => p.x == position.x - 1 && p.y == position.y)
        && !getState().path.find((p) => p.x == position.x + 1 && p.y == position.y)
        && position.y > 2
        && position.y < 18
        && position.x > 2
        && position.x < 18
        && !getState().traps.find((t) => JSON.stringify(position) == JSON.stringify(t.gridPosition)))
      {
        return position;  
      }
    } 
  }

  renderTiles()
  {
    return getState().path.map((gridPosition) =>
    {
      const tileProps: ITileProps = {
        gridPosition
      };
      return Tile(tileProps);
    });
  }

  renderCreeps()
  {
    return getState().creeps.map((creep) =>
    {
      return Creep(creep);
    });
  }

  renderTraps()
  {
    return getState().traps.map((trap) =>
    {
      return Trap(trap);
    });
  }
  
  async render() 
  {
    const endOfPath = getState().path[getState().path.length - 2];
    return (
      <scene>
        <material
          id="floorTileMaterial"
          albedoTexture="./assets/StoneFloor.png"
        />
        {this.renderTiles()}

        <plane
          position={{x: 10, y: 0, z: 10}}
          rotation={{x: 90, y: 0, z: 0}}
          scale={19.99}
          color="#666666"
        />
        <gltf-model
          src="assets/Archway/StoneArchway.gltf"
          position={{x: 10, y: 0, z: 2}}
          rotation={{x: 0, y: 180, z: 0}}
          scale={{x: 1, y: 1, z: 1.5}}
        />
        <gltf-model
          src="assets/Archway/StoneArchway.gltf"
          position={{x: endOfPath.x, y: 0, z: endOfPath.y}}
          scale={{x: 1, y: 1, z: 1.5}}
        />

        {this.renderCreeps()}
        {this.renderTraps()}
        {ScoreBoard(getState().score)}
        {Button(getState().startButton)}
      </scene>
    )
  }
}

function getStartPosition(): Vector2Component
{
  return {x: 10, y: 1};
}

function isValidPosition(position: Vector2Component)
{
  return position.x >= 1 
    && position.x < 19 
    && position.y >= 1 
    && position.y < 19
    && (position.x < 18 || position.y < 18)
    && (position.x > 1 || position.y > 1);
}

function generatePath(): Vector2Component[]
{
  const path: Vector2Component[] = [];
  let position = getStartPosition();
  path.push(JSON.parse(JSON.stringify(position)));
  for(let i = 0; i < 2; i++)
  {
    position.y++;
    path.push(JSON.parse(JSON.stringify(position)));
  }

  let counter = 0;
  while(position.y < 18)
  {
    if(counter++ > 1000)
    {
      throw new Error("Invalid path, try again");
    }
    let nextPosition = {x: position.x, y: position.y};
    switch(Math.floor(Math.random() * 3))
    {
      case 0:
        nextPosition.x += 1;
        break;
      case 1:
        nextPosition.x -= 1;
        break;
      default:
        nextPosition.y += 1;
    }
    if(!isValidPosition(nextPosition) 
      || path.find((p) => p.x == nextPosition.x && p.y == nextPosition.y)
      || getNeighborCount(path, nextPosition) > 1)
    {
      continue;
    }
    position = nextPosition;
    path.push(JSON.parse(JSON.stringify(position)));
  }
  position.y++;
  path.push(JSON.parse(JSON.stringify(position)));
  return path;
}

function getNeighborCount(path: Vector2Component[], position: Vector2Component)
{
  const neighbors: {x: number, y: number}[] = [
    {x: position.x + 1, y: position.y},
    {x: position.x - 1, y: position.y},
    {x: position.x, y: position.y + 1},
    {x: position.x, y: position.y - 1},
  ];

  let count = 0;
  for(const neighbor of neighbors)
  {
    if(path.find((p) => p.x == neighbor.x && p.y == neighbor.y))
    {
      count++;
    }
  }

  return count;
}